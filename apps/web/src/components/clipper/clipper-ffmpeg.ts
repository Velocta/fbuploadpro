/**
 * Clipper ffmpeg argv builders — pure functions, unit-tested, and verified
 * against a local ffmpeg on generated fixtures (see the unit tests).
 *
 * These args are passed to the frozen `process_spawn` command with the
 * `ffmpeg` binaryId, so the binary is resolved ONLY through 145's runtime
 * manager — never via PATH, never user-supplied (spec §11 R12, plan §10
 * variance V-FFMPEG). Outputs are relative paths: the spawn runs with
 * cwd = the picked output-folder scope, so writes stay inside the folder
 * the user chose. The only absolute path ever passed is the user-picked
 * source file, as a read-only input.
 */

/** 16 kHz mono WAV for the whisper sidecar (spec §7 step 4). */
export function buildWavExtractArgs(inputAbsolutePath: string, outputRelativePath: string): string[] {
  return ['-y', '-i', inputAbsolutePath, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputRelativePath];
}

/** Per-frame astats pass; stderr is parsed by `parseAstatsStderr`. */
export function buildAstatsArgs(inputAbsolutePath: string): string[] {
  return [
    '-i',
    inputAbsolutePath,
    '-vn',
    '-af',
    'astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level',
    '-f',
    'null',
    '-',
  ];
}

export interface ExportArgsInput {
  inputAbsolutePath: string;
  /** Seconds to skip before the clip start (fast-seek headroom, default 10). */
  seekHeadroomSeconds?: number;
  startSeconds: number;
  endSeconds: number;
  aspect: 'vertical' | 'original';
  /** Relative ASS path inside the output scope (cwd). */
  assRelativePath: string;
  outputRelativePath: string;
}

/**
 * Per-clip export: accurate cut (fast seek + accurate skip + duration),
 * centre-crop to 9:16 at 1080×1920 for vertical mode, source aspect kept
 * for original mode (even-dimension guard only), ASS burn-in, H.264 + AAC.
 * Vertical crop uses escaped commas in the filtergraph (`,` would
 * otherwise split filters); argv carries no shell, so the backslashes
 * reach ffmpeg's filter parser intact.
 */
export function buildExportArgs(input: ExportArgsInput): string[] {
  const headroom = input.seekHeadroomSeconds ?? 10;
  const inputSeek = Math.max(0, input.startSeconds - headroom);
  const accurateSkip = input.startSeconds - inputSeek;
  const duration = input.endSeconds - input.startSeconds;
  const cropFilter =
    input.aspect === 'vertical'
      ? 'crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9),scale=1080:1920'
      : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  const filter = `${cropFilter},subtitles=${input.assRelativePath}`;
  const args: string[] = ['-y', '-ss', String(inputSeek), '-i', input.inputAbsolutePath];
  if (accurateSkip > 0) args.push('-ss', String(accurateSkip));
  args.push(
    '-t',
    String(duration),
    '-vf',
    filter,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    input.outputRelativePath,
  );
  return args;
}

/** Single-frame thumbnail at the clip midpoint. */
export function buildThumbnailArgs(
  inputAbsolutePath: string,
  atSeconds: number,
  outputRelativePath: string,
): string[] {
  return ['-y', '-ss', String(Math.max(0, atSeconds)), '-i', inputAbsolutePath, '-frames:v', '1', '-q:v', '3', outputRelativePath];
}
