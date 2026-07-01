import * as vscode from "vscode";
import * as path from "path";
import { SoundPlayer } from "./soundPlayer";
import { CommunityFetcher, CommunityManifest, CommunitySound } from "./communityFetcher";

const GITHUB_ISSUE_URL =
  "https://github.com/MiessanEmmanuel/sound-ivory/issues/new?template=sound-submission.yml";

export class AdminPanel {
  private panel: vscode.WebviewPanel | undefined;
  private fetcher: CommunityFetcher;

  constructor(
    private context: vscode.ExtensionContext,
    private player: SoundPlayer
  ) {
    this.fetcher = new CommunityFetcher(context.globalStorageUri.fsPath);

    // Reflect playback state in the webview so Preview buttons can toggle.
    this.player.onStateChange((state) => {
      this.panel?.webview.postMessage({
        command: "playState",
        playing: state.playing,
        file: state.file ?? null,
      });
    });
  }

  show(tab: "my" | "community" = "my"): void {
    if (this.panel) {
      this.panel.reveal();
      this.panel.webview.postMessage({ command: "switchTab", tab });
      return;
    }
   /* TODO: JE DOIS REPRENDRE  */
    this.panel = vscode.window.createWebviewPanel(
      "codeRefAdmin",
      "Code Ref",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.command) {
        case "addSound": {
          const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: {
              "Audio & Video": ["mp3", "wav", "ogg", "aiff", "mp4", "mov", "avi", "mkv", "webm", "m4v"],
            },
            title: "Select audio or video files (video → MP3, max 17s)",
          });
          if (uris && uris.length > 0) {
            await vscode.window.withProgress(
              { location: vscode.ProgressLocation.Notification, title: "Code Ref: Processing…", cancellable: false },
              async (progress) => {
                for (let i = 0; i < uris.length; i++) {
                  const uri = uris[i];
                  const name = uri.fsPath.split("/").pop() ?? uri.fsPath;
                  progress.report({ message: `(${i + 1}/${uris.length}) ${name}`, increment: 100 / uris.length });
                  try {
                    await this.player.addSound(uri.fsPath);
                  } catch (e: unknown) {
                    vscode.window.showErrorMessage(
                      `Code Ref: Failed to process "${name}": ${e instanceof Error ? e.message : String(e)}`
                    );
                  }
                }
              }
            );
            this.refreshMySounds();
          }
          break;
        }

        case "removeSound":
          this.player.removeSound(msg.fileName);
          this.refreshMySounds();
          break;

        case "previewMySound": {
          // Toggle: clicking the sound that's already playing stops it.
          if (this.player.isCurrentlyPlaying() && this.player.currentFile() === msg.fileName) {
            this.player.stop();
            break;
          }
          const config = vscode.workspace.getConfiguration("codeRef");
          const filePath = path.join(this.context.globalStorageUri.fsPath, "sounds", msg.fileName);
          this.player.preview(filePath, config.get<number>("volume", 0.8));
          break;
        }

        case "stopSound":
          this.player.stop();
          break;

        case "fetchCommunity":
          this.loadCommunityTab();
          break;

        case "downloadCommunitySound": {
          const sound: CommunitySound = msg.sound;
          try {
            await vscode.window.withProgress(
              { location: vscode.ProgressLocation.Notification, title: `Downloading "${sound.name}"…`, cancellable: false },
              () => this.fetcher.downloadSound(sound)
            );
            vscode.window.showInformationMessage(`"${sound.name}" added to your library!`);
            this.loadCommunityTab();
          } catch (e: unknown) {
            vscode.window.showErrorMessage(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
          }
          break;
        }

        case "removeCommunitySound":
          this.fetcher.removeSound(msg.fileName);
          this.loadCommunityTab();
          break;

        case "previewCommunitySound": {
          if (this.player.isCurrentlyPlaying() && this.player.currentFile() === msg.fileName) {
            this.player.stop();
            break;
          }
          const config = vscode.workspace.getConfiguration("codeRef");
          const filePath = path.join(this.context.globalStorageUri.fsPath, "community", msg.fileName);
          this.player.preview(filePath, config.get<number>("volume", 0.8));
          break;
        }

        case "submitSound":
          vscode.env.openExternal(vscode.Uri.parse(GITHUB_ISSUE_URL));
          break;

        case "requestMySounds":
          this.refreshMySounds();
          break;
      }
    });

    this.panel.webview.html = this.getShellHtml(tab);
    if (tab === "community") {
      setTimeout(() => this.loadCommunityTab(), 300);
    }
  }

  private refreshMySounds(): void {
    this.panel?.webview.postMessage({
      command: "updateMySounds",
      sounds: this.player.getSounds(),
    });
  }

  private async loadCommunityTab(): Promise<void> {
    this.panel?.webview.postMessage({ command: "communityLoading" });
    try {
      const manifest: CommunityManifest = await this.fetcher.fetchManifest();
      const downloaded = new Set(this.fetcher.getDownloadedSounds());
      this.panel?.webview.postMessage({
        command: "communityLoaded",
        sounds: manifest.sounds,
        downloaded: [...downloaded],
      });
    } catch (e: unknown) {
      this.panel?.webview.postMessage({
        command: "communityError",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private getShellHtml(activeTab: "my" | "community"): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Code Ref</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 0; margin: 0; }
  header { padding: 20px 24px 0; border-bottom: 1px solid var(--vscode-widget-border); }
  h1 { font-size: 1.3rem; margin: 0 0 16px; }
  .tabs { display: flex; gap: 0; }
  .tab { padding: 8px 20px; cursor: pointer; border: 1px solid transparent; border-bottom: none; border-radius: 4px 4px 0 0; font-size: 0.9rem; background: none; color: var(--vscode-descriptionForeground); }
  .tab.active { background: var(--vscode-editor-background); border-color: var(--vscode-widget-border); color: var(--vscode-foreground); font-weight: 600; margin-bottom: -1px; }
  .tab:hover:not(.active) { color: var(--vscode-foreground); }
  main { padding: 20px 24px; }
  .pane { display: none; }
  .pane.active { display: block; }

  .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; padding: 6px 14px; cursor: pointer; font-size: 0.85rem; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button.danger { background: transparent; color: var(--vscode-errorForeground); border: 1px solid var(--vscode-errorForeground); }
  button.small { padding: 3px 10px; font-size: 0.8rem; }
  button.playing { background: var(--vscode-errorForeground); color: #fff; font-weight: 600; }
  button.playing:hover { opacity: 0.85; }

  .now-playing { display: none; align-items: center; gap: 10px; margin: 12px 0 0; padding: 8px 12px; background: var(--vscode-inputValidation-infoBackground, var(--vscode-textBlockQuote-background)); border-radius: 4px; font-size: 0.85rem; }
  .now-playing.visible { display: flex; }
  .now-playing .label { flex: 1; }
  .now-playing .bars { display: inline-flex; gap: 2px; align-items: flex-end; height: 14px; }
  .now-playing .bars span { width: 3px; background: var(--vscode-errorForeground); animation: eq 0.8s ease-in-out infinite; }
  .now-playing .bars span:nth-child(1){ height: 6px; animation-delay: 0s; }
  .now-playing .bars span:nth-child(2){ height: 12px; animation-delay: 0.15s; }
  .now-playing .bars span:nth-child(3){ height: 8px; animation-delay: 0.3s; }
  @keyframes eq { 0%,100%{ transform: scaleY(0.5);} 50%{ transform: scaleY(1);} }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--vscode-widget-border); color: var(--vscode-descriptionForeground); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 9px 10px; border-bottom: 1px solid var(--vscode-widget-border); vertical-align: middle; }
  td.actions { text-align: right; white-space: nowrap; }
  td.name { font-family: var(--vscode-editor-font-family); font-size: 0.9rem; }
  .empty { color: var(--vscode-descriptionForeground); font-style: italic; padding: 20px 10px; }

  .tags { display: flex; gap: 4px; flex-wrap: wrap; }
  .tag { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 10px; padding: 1px 8px; font-size: 0.75rem; }
  .author { color: var(--vscode-descriptionForeground); font-size: 0.8rem; }
  .badge-downloaded { background: var(--vscode-testing-iconPassed, #4caf50); color: #fff; border-radius: 10px; padding: 1px 8px; font-size: 0.75rem; }

  .status { color: var(--vscode-descriptionForeground); font-size: 0.85rem; }
  .error { color: var(--vscode-errorForeground); font-size: 0.85rem; }
  .count { color: var(--vscode-descriptionForeground); font-size: 0.85rem; }

  .submit-banner { background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textLink-foreground); padding: 12px 16px; margin-bottom: 20px; border-radius: 0 4px 4px 0; }
  .submit-banner p { margin: 0 0 8px; font-size: 0.88rem; }
  .submit-banner p:last-child { margin: 0; }
</style>
</head>
<body>
<header>
  <h1>🔊 Code Ref</h1>
  <div class="tabs">
    <button class="tab ${activeTab === "my" ? "active" : ""}" onclick="switchTab('my')">My Sounds</button>
    <button class="tab ${activeTab === "community" ? "active" : ""}" onclick="switchTab('community')">Community</button>
  </div>
  <div id="now-playing" class="now-playing">
    <span class="bars"><span></span><span></span><span></span></span>
    <span class="label" id="now-playing-label">Playing…</span>
    <button class="danger small" onclick="send('stopSound')">⏹ Stop</button>
  </div>
</header>

<main>
  <!-- MY SOUNDS -->
  <div id="pane-my" class="pane ${activeTab === "my" ? "active" : ""}">
    <div class="toolbar">
      <button onclick="send('addSound')">+ Add Sounds / Videos</button>
      <span class="count" id="my-count"></span>
    </div>
    <table>
      <thead><tr><th>File</th><th></th></tr></thead>
      <tbody id="my-tbody"><tr><td colspan="2" class="empty">Loading…</td></tr></tbody>
    </table>
  </div>

  <!-- COMMUNITY -->
  <div id="pane-community" class="pane ${activeTab === "community" ? "active" : ""}">
    <div class="submit-banner">
      <p>Want to share a sound with the community? Submit it for review.</p>
      <button class="secondary" onclick="send('submitSound')">🎵 Submit a Sound</button>
    </div>
    <div class="toolbar">
      <button class="secondary" onclick="send('fetchCommunity')">↻ Refresh</button>
      <span id="community-status" class="status"></span>
    </div>
    <table>
      <thead><tr><th>Name</th><th>Author</th><th>Tags</th><th></th></tr></thead>
      <tbody id="community-tbody"><tr><td colspan="4" class="empty">Click Refresh to load community sounds.</td></tr></tbody>
    </table>
  </div>
</main>

<script>
  const vscode = acquireVsCodeApi();
  function send(command, extra) { vscode.postMessage({ command, ...extra }); }

  // Playback state, kept in sync via 'playState' messages from the extension.
  let playingFile = null;
  let mySoundsData = [];
  let communityData = null;
  let communityDownloaded = [];

  function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    document.querySelector('[onclick="switchTab(\\''+tab+'\\')"]').classList.add('active');
    document.getElementById('pane-'+tab).classList.add('active');
    if (tab === 'community') send('fetchCommunity');
  }

  function renderMySounds(sounds) {
    mySoundsData = sounds;
    const tbody = document.getElementById('my-tbody');
    document.getElementById('my-count').textContent = sounds.length + ' sound' + (sounds.length !== 1 ? 's' : '');
    if (!sounds.length) {
      tbody.innerHTML = '<tr><td colspan="2" class="empty">No sounds yet. Click "Add Sounds / Videos" to get started.</td></tr>';
      return;
    }
    tbody.innerHTML = sounds.map(s => {
      const isThis = playingFile === s;
      const btn = isThis
        ? \`<button class="small playing" onclick="send('previewMySound',{fileName:'\${esc(s)}'})">⏹ Stop</button>\`
        : \`<button class="small" onclick="send('previewMySound',{fileName:'\${esc(s)}'})">▶ Preview</button>\`;
      return \`
      <tr>
        <td class="name">\${esc(s)}</td>
        <td class="actions">
          \${btn}
          <button class="small danger" onclick="send('removeSound',{fileName:'\${esc(s)}'})">✕</button>
        </td>
      </tr>\`;
    }).join('');
  }

  function renderCommunity(sounds, downloaded) {
    communityData = sounds;
    communityDownloaded = downloaded;
    const tbody = document.getElementById('community-tbody');
    const dl = new Set(downloaded);
    document.getElementById('community-status').textContent = sounds.length + ' sound' + (sounds.length !== 1 ? 's' : '') + ' available';
    if (!sounds.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">No community sounds yet. Be the first to submit one!</td></tr>';
      return;
    }
    tbody.innerHTML = sounds.map(s => {
      const isDown = dl.has(s.file);
      const isThis = playingFile === s.file;
      const previewBtn = isThis
        ? \`<button class="small playing" onclick="send('previewCommunitySound',{fileName:'\${esc(s.file)}'})">⏹</button>\`
        : \`<button class="small" onclick="send('previewCommunitySound',{fileName:'\${esc(s.file)}'})">▶</button>\`;
      const tags = (s.tags||[]).map(t => \`<span class="tag">\${esc(t)}</span>\`).join('');
      const actions = isDown
        ? \`<span class="badge-downloaded">✓ In library</span>
           \${previewBtn}
           <button class="small danger" onclick="send('removeCommunitySound',{fileName:'\${esc(s.file)}'})">✕</button>\`
        : \`<button class="small" onclick='send("downloadCommunitySound",{sound:\${JSON.stringify(s)}})'>⬇ Add</button>\`;
      return \`<tr>
        <td class="name">\${esc(s.name)}<br><span style="font-size:0.75rem;color:var(--vscode-descriptionForeground)">\${s.duration}s</span></td>
        <td class="author">@\${esc(s.author)}</td>
        <td><div class="tags">\${tags}</div></td>
        <td class="actions">\${actions}</td>
      </tr>\`;
    }).join('');
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function applyPlayState(playing, file) {
    playingFile = playing ? file : null;

    const np = document.getElementById('now-playing');
    const label = document.getElementById('now-playing-label');
    if (playingFile) {
      np.classList.add('visible');
      label.textContent = 'Playing: ' + playingFile;
    } else {
      np.classList.remove('visible');
    }

    // Re-render lists so Preview/Stop buttons reflect the new state.
    if (mySoundsData.length) renderMySounds(mySoundsData);
    if (communityData) renderCommunity(communityData, communityDownloaded);
  }

  window.addEventListener('message', e => {
    const msg = e.data;
    switch(msg.command) {
      case 'updateMySounds': renderMySounds(msg.sounds); break;
      case 'communityLoading':
        document.getElementById('community-status').textContent = 'Loading…';
        document.getElementById('community-tbody').innerHTML = '<tr><td colspan="4" class="empty">Fetching community sounds…</td></tr>';
        break;
      case 'communityLoaded': renderCommunity(msg.sounds, msg.downloaded); break;
      case 'communityError':
        document.getElementById('community-status').className = 'error';
        document.getElementById('community-status').textContent = 'Error: ' + msg.message;
        break;
      case 'switchTab': switchTab(msg.tab); break;
      case 'playState': applyPlayState(msg.playing, msg.file); break;
    }
  });

  // initial load
  renderMySounds(${JSON.stringify([])}); // will be updated via message
  vscode.postMessage({ command: 'requestMySounds' });
</script>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
