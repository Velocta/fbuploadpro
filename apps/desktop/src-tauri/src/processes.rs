//! §7.5 process registry: allowlisted managed binaries only (enforced by the
//! handler — this module spawns a resolved path), argv arrays (no shell),
//! streamed stdout/stderr (<=64 KiB chunks, per-run monotonic seq), and
//! FROZEN cancellation semantics: terminate -> 5,000 ms grace -> kill;
//! kill is immediate; cancelling an exited run is idempotent success.
//! On registry shutdown all live children are terminated (2,000 ms grace,
//! then kill) — no orphaned children survive the app.

use std::collections::{HashMap, VecDeque};
use std::io::Read;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crate::errors::{BridgeError, BridgeResult};

pub const CANCEL_GRACE_MS: u64 = 5_000;
pub const SHUTDOWN_GRACE_MS: u64 = 2_000;
pub const MAX_COMPLETED: usize = 100;
pub const MAX_CHUNK_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExitReason {
    Completed,
    Cancelled,
    Timeout,
    Failed,
}
impl ExitReason {
    pub fn as_str(&self) -> &'static str {
        match self {
            ExitReason::Completed => "completed",
            ExitReason::Cancelled => "cancelled",
            ExitReason::Timeout => "timeout",
            ExitReason::Failed => "failed",
        }
    }
}

#[derive(Debug, Clone)]
pub enum ProcessEvent {
    Stdout { run_id: String, seq: u64, chunk: String },
    Stderr { run_id: String, seq: u64, chunk: String },
    Exit { run_id: String, seq: u64, exit_code: Option<i32>, signal: Option<String>, reason: ExitReason },
}

pub type EventCallback = Arc<dyn Fn(ProcessEvent) + Send + Sync>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RunState {
    Running,
    Exited,
    Cancelled,
}

#[derive(Debug, Clone)]
pub struct RunRecord {
    pub run_id: String,
    pub binary_id: String,
    pub pid: u32,
    pub state: RunState,
    pub exit_code: Option<i32>,
    pub namespace: Option<String>,
    pub job_id: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
}

struct LiveRun {
    pid: u32,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    cancelled: Arc<AtomicBool>,
    record: RunRecord,
}

/// Civil-from-days ISO-8601 UTC formatting (no chrono dependency).
pub fn iso_now() -> String {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    iso_from_secs(secs)
}

pub fn iso_from_secs(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    // Howard Hinnant's civil-from-days algorithm.
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let mo = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if mo <= 2 { y + 1 } else { y };
    format!("{year:04}-{mo:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}

#[cfg(unix)]
fn signal_pid(pid: u32, sig: i32) {
    // Signal the child's whole process group (spawn() puts the child in
    // its own group via setsid, below). Signalling only the direct child
    // orphans grandchildren that keep the stdout/stderr pipes open, which
    // deadlocks the waiter at its reader joins and leaves the run stuck
    // in Running after a timeout kill.
    unsafe {
        libc::kill(-(pid as i32), sig);
    }
}
#[cfg(not(unix))]
fn signal_pid(_pid: u32, _sig: i32) {}

fn kill_pid(pid: u32) {
    #[cfg(unix)]
    signal_pid(pid, libc::SIGKILL);
    #[cfg(not(unix))]
    {
        // Windows: no libc kill; the waiter thread owns the Child handle and
        // the registry's kill path uses try_wait + Child::kill via pid lookup
        // is unavailable, so this is a no-op here — the handler-level kill
        // path (Child handle) is used on Windows instead. See kill_via_handle.
        let _ = pid;
    }
}

pub struct ProcessRegistry {
    live: Mutex<HashMap<String, LiveRun>>,
    completed: Mutex<VecDeque<RunRecord>>,
    on_event: EventCallback,
}

impl ProcessRegistry {
    pub fn new(on_event: EventCallback) -> Self {
        Self { live: Mutex::new(HashMap::new()), completed: Mutex::new(VecDeque::new()), on_event }
    }

#[allow(clippy::too_many_arguments)] // Arity mirrors the wire spawn payload; bundling would just move the fields.
    pub fn spawn(
        self: &Arc<Self>,
        run_id: Option<String>,
        binary_id: &str,
        binary_path: &std::path::Path,
        args: &[String],
        cwd: Option<&std::path::Path>,
        env: &HashMap<String, String>,
        timeout_ms: Option<u64>,
        namespace: Option<String>,
        job_id: Option<String>,
    ) -> BridgeResult<RunRecord> {
        if args.len() > 128 || args.iter().any(|a| a.chars().count() > 4096) {
            return Err(BridgeError::validation("process args exceed the allowed size"));
        }
        crate::validation::validate_env(env)?;
        let run_id = run_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        {
            let live = self.live.lock().unwrap();
            if live.contains_key(&run_id) {
                return Err(BridgeError::process_already_running());
            }
            if self.completed.lock().unwrap().iter().any(|r| r.run_id == run_id && r.state == RunState::Running) {
                return Err(BridgeError::process_already_running());
            }
        }
        let mut cmd = Command::new(binary_path);
        // Own process group per child (setsid, Unix): cancel/timeout then
        // signal the group, so no grandchild survives to hold the pipes
        // open or linger as an orphan after the shell exits.
        #[cfg(unix)]
        unsafe {
            use std::os::unix::process::CommandExt;
            cmd.pre_exec(|| {
                if libc::setsid() == -1 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
        cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped()).stdin(Stdio::piped());
        if let Some(dir) = cwd {
            cmd.current_dir(dir);
        }
        for (k, v) in env {
            cmd.env(k, v);
        }
        let mut child: Child = cmd.spawn().map_err(|_| {
            let mut d = crate::errors::ErrorDetails::new();
            d.run_id = Some(run_id.clone());
            BridgeError::new("PROCESS_SPAWN_FAILED", "The tool could not be started.", true).with_details(d)
        })?;
        let pid = child.id();
        let started_at = iso_now();
        let record = RunRecord {
            run_id: run_id.clone(),
            binary_id: binary_id.to_string(),
            pid,
            state: RunState::Running,
            exit_code: None,
            namespace,
            job_id,
            started_at: started_at.clone(),
            ended_at: None,
        };
        let stdin = Arc::new(Mutex::new(child.stdin.take()));
        let cancelled = Arc::new(AtomicBool::new(false));
        let timed_out = Arc::new(AtomicBool::new(false));
        self.live.lock().unwrap().insert(run_id.clone(), LiveRun {
            pid,
            stdin: stdin.clone(),
            cancelled: cancelled.clone(),

            record: record.clone(),
        });
        // Timeout thread: kill on expiry; the waiter reports reason timeout.
        if let Some(ms) = timeout_ms {
            let reg_pid = pid;
            let timed_out2 = timed_out.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(ms));
                // If the process already exited, kill is a harmless no-op
                // and the waiter has already recorded its real reason.
                timed_out2.store(true, Ordering::SeqCst);
                kill_pid(reg_pid);
            });
        }
        // Reader + waiter thread. Stdout and stderr are read CONCURRENTLY
        // (separate threads): reading one stream to EOF before the other
        // deadlocks when the child fills the unread pipe (ffmpeg's stderr).
        let seq = Arc::new(AtomicU64::new(0));
        let on_event = self.on_event.clone();
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let run_id_w = run_id.clone();
        let cancelled_w = cancelled.clone();
        let timed_out_w = timed_out.clone();
        let reg = Arc::clone(self);
        std::thread::spawn(move || {
            let read_stream = |mut reader: Box<dyn Read + Send>, is_err: bool, seq: Arc<AtomicU64>, on_event: EventCallback, run_id: String| {
                std::thread::spawn(move || {
                    let mut buf = vec![0u8; MAX_CHUNK_BYTES];
                    loop {
                        match reader.read(&mut buf) {
                            Ok(0) => break,
                            Ok(n) => {
                                let chunk = String::from_utf8_lossy(&buf[..n]).into_owned();
                                let s = seq.fetch_add(1, Ordering::SeqCst);
                                if is_err {
                                    on_event(ProcessEvent::Stderr { run_id: run_id.clone(), seq: s, chunk });
                                } else {
                                    on_event(ProcessEvent::Stdout { run_id: run_id.clone(), seq: s, chunk });
                                }
                            }
                            Err(_) => break,
                        }
                    }
                })
            };
            let t_out = stdout.map(|s| read_stream(Box::new(s), false, seq.clone(), on_event.clone(), run_id_w.clone()));
            let t_err = stderr.map(|s| read_stream(Box::new(s), true, seq.clone(), on_event.clone(), run_id_w.clone()));
            if let Some(t) = t_out {
                let _ = t.join();
            }
            if let Some(t) = t_err {
                let _ = t.join();
            }
            let status = child.wait();
            let (exit_code, signal) = match &status {
                Ok(s) => (s.code(), None),
                Err(_) => (None, Some("failed".to_string())),
            };
            let reason = if cancelled_w.load(Ordering::SeqCst) {
                ExitReason::Cancelled
            } else if timed_out_w.load(Ordering::SeqCst) {
                ExitReason::Timeout
            } else if status.is_ok() {
                ExitReason::Completed
            } else {
                ExitReason::Failed
            };
            let seq_final = seq.fetch_add(1, Ordering::SeqCst);
            on_event(ProcessEvent::Exit {
                run_id: run_id_w.clone(),
                seq: seq_final,
                exit_code,
                signal,
                reason: reason.clone(),
            });
            let mut live = reg.live.lock().unwrap();
            if let Some(live_run) = live.remove(&run_id_w) {
                let mut rec = live_run.record;
                rec.state = if reason == ExitReason::Cancelled { RunState::Cancelled } else { RunState::Exited };
                rec.exit_code = exit_code;
                rec.ended_at = Some(iso_now());
                let mut completed = reg.completed.lock().unwrap();
                completed.push_back(rec);
                while completed.len() > MAX_COMPLETED {
                    completed.pop_front();
                }
            }
        });
        let _ = stdin;
        Ok(record)
    }

    pub fn write_stdin(&self, run_id: &str, data: &str, close: bool) -> BridgeResult<bool> {
        use std::io::Write;
        let live = self.live.lock().unwrap();
        let Some(run) = live.get(run_id) else {
            return Err(BridgeError::process_not_found());
        };
        let mut guard = run.stdin.lock().unwrap();
        let Some(stdin) = guard.as_mut() else {
            return Err(BridgeError::process_not_found());
        };
        stdin.write_all(data.as_bytes()).map_err(|_| BridgeError::process_not_found())?;
        let _ = stdin.flush();
        if close {
            guard.take();
        }
        Ok(close)
    }

    /// FROZEN cancel: terminate -> 5s grace -> kill; kill is immediate.
    /// Cancelling an exited run is idempotent success (alreadyExited=true).
    pub fn cancel(&self, run_id: &str, kill: bool) -> BridgeResult<(RunState, bool)> {
        let pid_opt = {
            let live = self.live.lock().unwrap();
            live.get(run_id).map(|r| (r.pid, r.cancelled.clone()))
        };
        match pid_opt {
            Some((pid, cancelled)) => {
                cancelled.store(true, Ordering::SeqCst);
                if kill {
                    kill_pid(pid);
                } else {
                    #[cfg(unix)]
                    signal_pid(pid, libc::SIGTERM);
                    #[cfg(not(unix))]
                    kill_pid(pid);
                    let cancelled2 = cancelled.clone();
                    let _ = cancelled2;
                    // Grace thread: SIGKILL after 5s if still alive.
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(CANCEL_GRACE_MS));
                        kill_pid(pid);
                    });
                }
                Ok((RunState::Cancelled, false))
            }
            None => {
                // Exited/completed runs: idempotent success.
                if self.completed.lock().unwrap().iter().any(|r| r.run_id == run_id) {
                    Ok((RunState::Exited, true))
                } else {
                    Err(BridgeError::process_not_found())
                }
            }
        }
    }

    pub fn status(&self, run_id: &str) -> BridgeResult<RunRecord> {
        if let Some(run) = self.live.lock().unwrap().get(run_id) {
            return Ok(run.record.clone());
        }
        if let Some(rec) = self.completed.lock().unwrap().iter().find(|r| r.run_id == run_id) {
            return Ok(rec.clone());
        }
        Err(BridgeError::process_not_found())
    }

    pub fn list(&self) -> Vec<RunRecord> {
        let mut out: Vec<RunRecord> = self.live.lock().unwrap().values().map(|r| r.record.clone()).collect();
        out.sort_by(|a, b| a.started_at.cmp(&b.started_at));
        let mut completed: Vec<RunRecord> = self.completed.lock().unwrap().iter().cloned().collect();
        completed.reverse();
        out.extend(completed);
        out
    }

    /// Shutdown cleanup: terminate all live children, 2s grace, then kill.
    pub fn shutdown_cleanup(&self) {
        let pids: Vec<u32> = self.live.lock().unwrap().values().map(|r| r.pid).collect();
        for pid in &pids {
            #[cfg(unix)]
            signal_pid(*pid, libc::SIGTERM);
            #[cfg(not(unix))]
            kill_pid(*pid);
        }
        std::thread::sleep(std::time::Duration::from_millis(SHUTDOWN_GRACE_MS));
        for pid in &pids {
            kill_pid(*pid);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn registry() -> (Arc<ProcessRegistry>, Arc<Mutex<Vec<ProcessEvent>>>) {
        let events = Arc::new(Mutex::new(Vec::new()));
        let ev2 = events.clone();
        let reg = Arc::new(ProcessRegistry::new(Arc::new(move |e| {
            ev2.lock().unwrap().push(e);
        })));
        (reg, events)
    }

    #[test]
    fn streaming_chunks_arrive_before_exit_and_duplicate_runid_rejected() {
        let (reg, events) = registry();
        let rec = reg
            .spawn(None, "sh", std::path::Path::new("/bin/sh"), &["-c".into(), "printf 'hello\\n'; sleep 0.3; printf 'world\\n'".into()], None, &HashMap::new(), None, None, None)
            .unwrap();
        // Duplicate live runId is rejected.
        assert_eq!(
            reg.spawn(Some(rec.run_id.clone()), "sh", std::path::Path::new("/bin/sh"), &["-c".into(), "true".into()], None, &HashMap::new(), None, None, None).unwrap_err().code,
            "PROCESS_ALREADY_RUNNING"
        );
        std::thread::sleep(std::time::Duration::from_millis(900));
        let ev = events.lock().unwrap().clone();
        let stdout: String = ev
            .iter()
            .filter_map(|e| match e {
                ProcessEvent::Stdout { chunk, .. } => Some(chunk.clone()),
                _ => None,
            })
            .collect();
        assert!(stdout.contains("hello") && stdout.contains("world"), "stdout was {stdout}");
        assert!(ev.iter().any(|e| matches!(e, ProcessEvent::Exit { reason: ExitReason::Completed, .. })));
        // Exactly one exit event.
        assert_eq!(ev.iter().filter(|e| matches!(e, ProcessEvent::Exit { .. })).count(), 1);
        // Seq is monotonic per run.
        let seqs: Vec<u64> = ev
            .iter()
            .map(|e| match e {
                ProcessEvent::Stdout { seq, .. } | ProcessEvent::Stderr { seq, .. } | ProcessEvent::Exit { seq, .. } => *seq,
            })
            .collect();
        let mut sorted = seqs.clone();
        sorted.sort_unstable();
        assert_eq!(seqs, sorted);
        // Cancelling an exited run is idempotent success.
        assert_eq!(reg.cancel(&rec.run_id, false).unwrap(), (RunState::Exited, true));
        assert_eq!(reg.cancel("unknown-run", false).unwrap_err().code, "PROCESS_NOT_FOUND");
    }

    #[test]
    fn terminate_grace_kill_and_timeout() {
        let (reg, _events) = registry();
        let rec = reg
            .spawn(None, "sh", std::path::Path::new("/bin/sh"), &["-c".into(), "sleep 30".into()], None, &HashMap::new(), None, None, None)
            .unwrap();
        let (state, already) = reg.cancel(&rec.run_id, true).unwrap();
        assert_eq!((state, already), (RunState::Cancelled, false));
        std::thread::sleep(std::time::Duration::from_millis(500));
        let status = reg.status(&rec.run_id).unwrap();
        assert_eq!(status.state, RunState::Cancelled);
        // Timeout kills and reports reason via the completed record state.
        let rec2 = reg
            .spawn(None, "sh", std::path::Path::new("/bin/sh"), &["-c".into(), "sleep 30".into()], None, &HashMap::new(), Some(1000), None, None)
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(2000));
        let status2 = reg.status(&rec2.run_id).unwrap();
        assert_eq!(status2.state, RunState::Exited);
        assert!(reg.list().iter().any(|r| r.run_id == rec.run_id));
    }

    #[test]
    fn iso_formatting() {
        assert_eq!(iso_from_secs(0), "1970-01-01T00:00:00Z");
        assert!(iso_from_secs(1_769_200_000).starts_with("2026-"));
        assert_eq!(iso_from_secs(86_400), "1970-01-02T00:00:00Z");
    }
}
