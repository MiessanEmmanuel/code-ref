import * as https from "https";
import * as fs from "fs";
import * as path from "path";

export interface CommunitySound {
  id: string;
  name: string;
  file: string;
  url: string;
  author: string;
  tags: string[];
  duration: number;
}

export interface CommunityManifest {
  version: number;
  sounds: CommunitySound[];
}

const MANIFEST_URL =
  "https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/sound-ivory/main/community/manifest.json";

export class CommunityFetcher {
  private cacheDir: string;

  constructor(storageDir: string) {
    this.cacheDir = path.join(storageDir, "community");
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  fetchManifest(): Promise<CommunityManifest> {
    return new Promise((resolve, reject) => {
      https
        .get(MANIFEST_URL, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data) as CommunityManifest);
            } catch {
              reject(new Error("Invalid manifest JSON"));
            }
          });
        })
        .on("error", reject);
    });
  }

  downloadSound(sound: CommunitySound): Promise<string> {
    const dest = path.join(this.cacheDir, sound.file);
    if (fs.existsSync(dest)) return Promise.resolve(dest);

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https
        .get(sound.url, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          res.pipe(file);
          file.on("finish", () => file.close(() => resolve(dest)));
        })
        .on("error", (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    });
  }

  getDownloadedSounds(): string[] {
    if (!fs.existsSync(this.cacheDir)) return [];
    return fs.readdirSync(this.cacheDir).filter((f) => /\.(mp3|wav)$/i.test(f));
  }

  isDownloaded(fileName: string): boolean {
    return fs.existsSync(path.join(this.cacheDir, fileName));
  }

  removeSound(fileName: string): void {
    const p = path.join(this.cacheDir, fileName);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}
