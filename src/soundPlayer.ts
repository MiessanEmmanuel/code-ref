import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";

const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv)$/i;
const MAX_DURATION_SECONDS = 17;

export class SoundPlayer {
  private soundsDir: string;
  private communityDir: string;
  private lastPlayedAt = 0;

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
    if (now - this.lastPlayedAt < cooldownMs) return;

    const all = this.getAllPlayablePaths();
    if (all.length === 0) return;

    const filePath = all[Math.floor(Math.random() * all.length)];
    this.lastPlayedAt = now;

    this.playFile(filePath, volume);
  }

  playFile(filePath: string, volume: number): void {
    const platform = process.platform;

    if (platform === "darwin") {
      execFile("afplay", ["-v", String(volume), filePath], () => {});
    } else if (platform === "win32") {
      // Pass path as a separate argument to avoid PowerShell injection
      execFile(
        "powershell",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "[System.Reflection.Assembly]::LoadWithPartialName('System.Media') | Out-Null; " +
          "$p = New-Object System.Media.SoundPlayer($args[0]); $p.PlaySync()",
          "--",
          filePath,
        ],
        () => {}
      );
    } else {
      execFile("paplay", [filePath], (err) => {
        if (err) execFile("aplay", [filePath], () => {});
      });
    }
  }

  addSound(sourcePath: string): Promise<string> {
    const ext = path.extname(sourcePath);
    if (VIDEO_EXTENSIONS.test(ext)) {
      return this.convertVideoToAudio(sourcePath);
    }
    const fileName = path.basename(sourcePath);
    const dest = path.join(this.soundsDir, fileName);
    fs.copyFileSync(sourcePath, dest);
    return Promise.resolve(fileName);
  }

  private convertVideoToAudio(sourcePath: string): Promise<string> {
    const baseName = path.basename(sourcePath, path.extname(sourcePath));
    const outputName = `${baseName}.mp3`;
    const outputPath = path.join(this.soundsDir, outputName);

    return new Promise((resolve, reject) => {
      execFile(
        "ffmpeg",
        [
          "-y",
          "-i", sourcePath,
          "-t", String(MAX_DURATION_SECONDS),
          "-vn",              // no video
          "-ar", "44100",     // sample rate
          "-ac", "2",         // stereo
          "-b:a", "192k",
          outputPath,
        ],
        (err, _stdout, stderr) => {
          if (err) {
            reject(new Error(`ffmpeg failed: ${stderr}`));
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
