import * as fs from "fs";
import * as path from "path";
import { execFile, ChildProcess } from "child_process";

const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv)$/i;
const MAX_DURATION_SECONDS = 17;

const FFMPEG_PATHS =
  process.platform === "win32"
    ? ["C:\\ffmpeg\\bin\\ffmpeg.exe", "ffmpeg"]
    : ["/usr/local/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/bin/ffmpeg", "ffmpeg"];

function findFfmpeg(): string {
  for (const p of FFMPEG_PATHS) {
    try {
      if (p === "ffmpeg" || require("fs").existsSync(p)) return p;
    } catch {}
  }
  return "ffmpeg";
}

export class SoundPlayer {
  private soundsDir: string;
  private communityDir: string;
  private lastPlayedAt = 0;
  private currentProcess: ChildProcess | undefined;

  constructor(soundsDir: string) {
    this.soundsDir = soundsDir;
    this.communityDir = path.join(path.dirname(soundsDir), "community");
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
    }
  }

  getSounds(): string[] {
    if (!fs.existsSync(this.soundsDir)) return [];
    return fs
      .readdirSync(this.soundsDir)
      .filter((f) => /\.(mp3|wav|ogg|aiff)$/i.test(f));
  }

  private getAllPlayablePaths(): string[] {
    const mine = this.getSounds().map((f) => path.join(this.soundsDir, f));
    const community = fs.existsSync(this.communityDir)
      ? fs.readdirSync(this.communityDir)
          .filter((f) => /\.(mp3|wav)$/i.test(f))
          .map((f) => path.join(this.communityDir, f))
      : [];
    return [...mine, ...community];
  }

  play(volume: number, cooldownMs: number): void {
    const now = Date.now();
    const isPlaying = this.currentProcess !== undefined;

    // If something is already playing, stop it and play the new one immediately.
    // If nothing is playing, apply the cooldown to avoid rapid-fire on save.
    if (!isPlaying && now - this.lastPlayedAt < cooldownMs) return;

    const all = this.getAllPlayablePaths();
    if (all.length === 0) return;

    const filePath = all[Math.floor(Math.random() * all.length)];
    this.lastPlayedAt = now;

    this.playFile(filePath, volume);
  }

  playFile(filePath: string, volume: number): void {
    this.stopCurrent();

    const platform = process.platform;

    if (platform === "darwin") {
      this.currentProcess = execFile(
        "/usr/bin/afplay",
        ["-v", String(volume), filePath],
        () => { this.currentProcess = undefined; }
      );
    } else if (platform === "win32") {
      this.currentProcess = execFile(
        "powershell",
        [
          "-NoProfile", "-NonInteractive", "-Command",
          "[System.Reflection.Assembly]::LoadWithPartialName('System.Media') | Out-Null; " +
          "$p = New-Object System.Media.SoundPlayer($args[0]); $p.PlaySync()",
          "--", filePath,
        ],
        () => { this.currentProcess = undefined; }
      );
    } else {
      this.currentProcess = execFile("paplay", [filePath], (err) => {
        if (err) {
          this.currentProcess = execFile("aplay", [filePath], () => {
            this.currentProcess = undefined;
          });
        } else {
          this.currentProcess = undefined;
        }
      });
    }
  }

  private stopCurrent(): void {
    if (this.currentProcess) {
      const proc = this.currentProcess;
      this.currentProcess = undefined;
      try {
        proc.kill("SIGKILL");
      } catch {}
    }
    // Belt-and-suspenders: kill any lingering afplay on macOS
    if (process.platform === "darwin") {
      execFile("/usr/bin/pkill", ["-x", "afplay"], () => {});
    }
  }

  addSound(sourcePath: string): Promise<string> {
    const ext = path.extname(sourcePath);
    if (VIDEO_EXTENSIONS.test(ext)) {
      return this.convertVideoToAudio(sourcePath);
    }
    const fileName = path.basename(sourcePath);
    const dest = path.join(this.soundsDir, fileName);
    try {
      fs.copyFileSync(sourcePath, dest);
    } catch {
      return Promise.reject(
        new Error(`Cannot access this file. Move it to your Desktop or Downloads folder first, then try again.`)
      );
    }
    return Promise.resolve(fileName);
  }

  private convertVideoToAudio(sourcePath: string): Promise<string> {
    if (!fs.existsSync(sourcePath)) {
      return Promise.reject(new Error(`File not found: ${sourcePath}`));
    }

    const baseName = path.basename(sourcePath, path.extname(sourcePath));
    const ext = path.extname(sourcePath);
    const outputName = `${baseName}.mp3`;
    const outputPath = path.join(this.soundsDir, outputName);

    // Copy to a temp dir first — files from AirDrop/sandboxed apps are not
    // directly accessible to child processes like ffmpeg
    const tmpPath = path.join(this.soundsDir, `_tmp_${Date.now()}${ext}`);
    try {
      fs.copyFileSync(sourcePath, tmpPath);
    } catch {
      return Promise.reject(new Error(`Cannot read file — try moving it to your Desktop first, then re-add it.`));
    }

    return new Promise((resolve, reject) => {
      execFile(
        findFfmpeg(),
        [
          "-y",
          "-i", tmpPath,
          "-t", String(MAX_DURATION_SECONDS),
          "-vn",
          "-ar", "44100",
          "-ac", "2",
          "-b:a", "192k",
          outputPath,
        ],
        { maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          try { fs.unlinkSync(tmpPath); } catch {}
          if (err) {
            const detail = (stderr || stdout || err.message || "unknown error").trim();
            reject(new Error(`ffmpeg failed: ${detail}`));
          } else {
            resolve(outputName);
          }
        }
      );
    });
  }

  removeSound(fileName: string): void {
    const safe = path.basename(fileName);
    const filePath = path.join(this.soundsDir, safe);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
