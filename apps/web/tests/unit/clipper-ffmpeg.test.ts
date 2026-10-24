/**
 * Spec 148 ffmpeg argv tests — pure builder assertions plus, when a local
 * ffmpeg/ffprobe exists, a real run of the exact vertical-export args
 * against a generated fixture (crop to 1080×1920, ASS burn-in, AAC audio).
 * The real-run test skips honestly where no ffmpeg is installed (CI
 * without ffmpeg) rather than pretending to verify the filtergraph.
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildAstatsArgs,
  buildExportArgs,
  buildThumbnailArgs,
  buildWavExtractArgs,
} from '@/components/clipper/clipper-ffmpeg';

const HAS_FFMPEG = (() => {
  try {
    execSync('command -v ffmpeg && command -v ffprobe', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('ffmpeg argv builders', () => {
  it('builds a 16 kHz mono WAV extract', () => {
    expect(buildWavExtractArgs('/src/talk.mp4', 'clipper-work-1/audio.wav')).toEqual([
      '-y', '-i', '/src/talk.mp4', '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', 'clipper-work-1/audio.wav',
    ]);
  });
  it('builds an astats pass over the source', () => {
    const args = buildAstatsArgs('/src/talk.mp4');
    expect(args).toContain('astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level');
    expect(args).toContain('-f');
  });
  it('builds a vertical export with centre-crop, scale, and subtitles burn-in', () => {
    const args = buildExportArgs({
      inputAbsolutePath: '/src/talk.mp4',
      startSeconds: 30,
      endSeconds: 60,
      aspect: 'vertical',
      assRelativePath: 'clipper-work-1/clip-01.ass',
      outputRelativePath: 'clip-01-test.mp4',
    });
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toContain('crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9)');
    expect(vf).toContain('scale=1080:1920');
    expect(vf).toContain('subtitles=clipper-work-1/clip-01.ass');
    expect(args).toContain('libx264');
    expect(args).toContain('aac');
  });
  it('builds an original-aspect export without any crop', () => {
    const args = buildExportArgs({
      inputAbsolutePath: '/src/talk.mp4',
      startSeconds: 0,
      endSeconds: 20,
      aspect: 'original',
      assRelativePath: 'clipper-work-1/clip-01.ass',
      outputRelativePath: 'clip-01-test.mp4',
    });
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).not.toContain('crop=');
    expect(vf).toContain('subtitles=clipper-work-1/clip-01.ass');
  });
  it('builds a single-frame thumbnail', () => {
    expect(buildThumbnailArgs('/src/talk.mp4', 45, 'clip-01-thumb.jpg')).toEqual([
      '-y', '-ss', '45', '-i', '/src/talk.mp4', '-frames:v', '1', '-q:v', '3', 'clip-01-thumb.jpg',
    ]);
  });
});

describe.skipIf(!HAS_FFMPEG)('real ffmpeg run of the vertical export args', () => {
  it('produces a playable 1080×1920 H.264/AAC MP4 with burned-in captions', () => {
    const dir = mkdtempSync(join(tmpdir(), 'clipper-ffmpeg-'));
    // 30 s 1280×720 testsrc + sine tone, then a 20 s vertical clip of it.
    execFileSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30:duration=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=30',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
      join(dir, 'source.mp4'),
    ], { stdio: 'ignore' });
    const ass = [
      '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1080', 'PlayResY: 1920', 'ScaledBorderAndShadow: yes', '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      'Style: Clipper,Arial,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,1,2,60,60,120,1', '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:00.00,0:00:10.00,Clipper,,0,0,0,,Hello captions',
    ].join('\n');
    writeFileSync(join(dir, 'clip-01.ass'), ass);
    const args = buildExportArgs({
      inputAbsolutePath: join(dir, 'source.mp4'),
      startSeconds: 5,
      endSeconds: 25,
      aspect: 'vertical',
      assRelativePath: 'clip-01.ass',
      outputRelativePath: 'clip-01-out.mp4',
    });
    execFileSync('ffmpeg', args, { cwd: dir, stdio: 'ignore' });
    const out = join(dir, 'clip-01-out.mp4');
    expect(existsSync(out)).toBe(true);
    const probe = execFileSync('ffprobe', [
      '-v', 'quiet', '-show_entries', 'stream=codec_name,width,height',
      '-of', 'csv=p=0', out,
    ]).toString();
    expect(probe).toContain('h264');
    expect(probe).toContain('1080');
    expect(probe).toContain('1920');
    expect(probe).toContain('aac');
  }, 120000);
});
