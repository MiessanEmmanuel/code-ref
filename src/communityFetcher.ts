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
  "https://raw.githubusercontent.com/MiessanEmmanuel/sound-ivory/main/community/manifest.json";

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

  private assertTrustedUrl(url: string): void {
    const allowed = /^https:\/\/raw\.githubusercontent\.com\/MiessanEmmanuel\//;
    if (!allowed.test(url)) {
      throw new Error(`Untrusted download URL blocked: ${url}`);
    }
  }

  downloadSound(sound: CommunitySound): Promise<string> {
    this.assertTrustedUrl(sound.url);

    const safeFile = path.basename(sound.file);
    if (!/\.(mp3|wav)$/i.test(safeFile)) {
      return Promise.reject(new Error(`Invalid file type: ${safeFile}`));
    }

    const dest = path.join(this.cacheDir, safeFile);
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
