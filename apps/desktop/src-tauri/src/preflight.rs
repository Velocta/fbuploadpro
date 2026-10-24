//! §5.4 reachability preflight: a plain HTTPS GET (8s timeout, redirects
//! followed, headers only — no auth, no body read beyond headers). Reachable
//! = 2xx/3xx. Anything else (network error, DNS failure, timeout, 5xx) is
//! "offline" and the shell shows the local fallback page.

use std::time::Duration;

pub const PREFLIGHT_TIMEOUT: Duration = Duration::from_secs(8);

/// Probe `url` with a blocking client. Kept client-constructible for tests
/// (a test server on localhost proves reachable/refused without the network).
pub fn preflight(url: &str) -> bool {
    let Ok(client) = reqwest::blocking::Client::builder()
        .timeout(PREFLIGHT_TIMEOUT)
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
    else {
        return false;
    };
    match client.get(url).send() {
        Ok(resp) => resp.status().is_success() || resp.status().is_redirection(),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};

    /// Minimal one-shot HTTP server on a free port, answering 200 or 500.
    fn serve_once(status: u16) -> u16 {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let mut buf = [0u8; 1024];
                let _ = stream.read(&mut buf);
                let body = "ok";
                let _ = stream.write_all(format!("HTTP/1.1 {status} Test\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).as_bytes());
            }
        });
        port
    }

    #[test]
    fn reachable_and_unreachable() {
        let port = serve_once(200);
        assert!(preflight(&format!("http://127.0.0.1:{port}/")));
        let port500 = serve_once(500);
        assert!(!preflight(&format!("http://127.0.0.1:{port500}/")));
        // Refused connection (nothing listening) is offline, not an error.
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let refused = listener.local_addr().unwrap().port();
        drop(listener);
        assert!(!preflight(&format!("http://127.0.0.1:{refused}/")));
    }
}
