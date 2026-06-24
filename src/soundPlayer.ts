import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";

export class SoundPlayer {
  private soundsDir: string;
  private lastPlayedAt = 0;

  constructor(soundsDir: string) {
    this.soundsDir = soundsDir;
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

  play(volume: number, cooldownMs: number): void {
    const now = Date.now();
    if (now - this.lastPlayedAt < cooldownMs) return;

    const sounds = this.getSounds();
    if (sounds.length === 0) return;

    const file = sounds[Math.floor(Math.random() * sounds.length)];
    const filePath = path.join(this.soundsDir, file);
    this.lastPlayedAt = now;

    this.playFile(filePath, volume);
  }

  playFile(filePath: string, volume: number): void {
    const platform = process.platform;

    if (platform === "darwin") {
      // afplay supports -v for volume (0.0–255, 1.0 = normal)
      execFile("afplay", ["-v", String(volume), filePath], () => {});
    } else if (platform === "win32") {
      const script = `
        $player = New-Object System.Media.SoundPlayer;
        $player.SoundLocation = '${filePath}';
        $player.PlaySync();
      `;
      execFile("powershell", ["-Command", script], () => {});
    } else {
      // Linux: try paplay, fallback to aplay
      execFile("paplay", [filePath], (err) => {
        if (err) execFile("aplay", [filePath], () => {});
      });
    }
  }

  addSound(sourcePath: string): string {
    const fileName = path.basename(sourcePath);
    const dest = path.join(this.soundsDir, fileName);
    fs.copyFileSync(sourcePath, dest);
    return fileName;
  }

  removeSound(fileName: string): void {
    const filePath = path.join(this.soundsDir, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
