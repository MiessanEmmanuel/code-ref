import * as vscode from "vscode";
import * as path from "path";
import { SoundPlayer } from "./soundPlayer";

export class AdminPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private player: SoundPlayer
  ) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "soundIvoryAdmin",
      "Sound Ivory — Manage Sounds",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.command) {
        case "addSound": {
          const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: { Audio: ["mp3", "wav", "ogg", "aiff"] },
            title: "Select sound files",
          });
          if (uris && uris.length > 0) {
            for (const uri of uris) {
              this.player.addSound(uri.fsPath);
            }
            this.refresh();
          }
          break;
        }
        case "removeSound":
          this.player.removeSound(msg.fileName);
          this.refresh();
          break;

        case "previewSound": {
          const config = vscode.workspace.getConfiguration("soundIvory");
          const volume = config.get<number>("volume", 0.8);
          const filePath = path.join(
            this.context.globalStorageUri.fsPath,
            "sounds",
            msg.fileName
          );
          this.player.playFile(filePath, volume);
          break;
        }
      }
    });

    this.refresh();
  }

  private refresh(): void {
    if (!this.panel) return;
    const sounds = this.player.getSounds();
    this.panel.webview.html = this.getHtml(sounds);
  }

  private getHtml(sounds: string[]): string {
    const rows =
      sounds.length === 0
        ? `<tr><td colspan="2" class="empty">No sounds yet. Click "Add Sounds" to get started.</td></tr>`
        : sounds
            .map(
              (s) => `
        <tr>
          <td class="name">${escapeHtml(s)}</td>
          <td class="actions">
            <button onclick="preview('${escapeHtml(s)}')">▶ Preview</button>
            <button class="danger" onclick="remove('${escapeHtml(s)}')">✕ Remove</button>
          </td>
        </tr>`
            )
            .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sound Ivory</title>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 24px; }
  h1 { font-size: 1.4rem; margin-bottom: 4px; }
  p.sub { color: var(--vscode-descriptionForeground); margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--vscode-widget-border); color: var(--vscode-descriptionForeground); font-size: 0.85rem; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--vscode-widget-border); }
  td.name { font-family: var(--vscode-editor-font-family); }
  td.empty { color: var(--vscode-descriptionForeground); font-style: italic; }
  td.actions { text-align: right; white-space: nowrap; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; padding: 4px 12px; cursor: pointer; margin-left: 6px; font-size: 0.85rem; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.danger { background: var(--vscode-inputValidation-errorBackground, #5a1d1d); }
  .toolbar { margin-bottom: 16px; }
  .toolbar button { padding: 8px 16px; font-size: 0.95rem; }
  .count { color: var(--vscode-descriptionForeground); font-size: 0.85rem; margin-left: 12px; }
</style>
</head>
<body>
<h1>🔊 Sound Ivory</h1>
<p class="sub">These sounds play randomly when a new bug appears in your code.</p>

<div class="toolbar">
  <button onclick="addSounds()">+ Add Sounds</button>
  <span class="count">${sounds.length} sound${sounds.length !== 1 ? "s" : ""} loaded</span>
</div>

<table>
  <thead><tr><th>File name</th><th></th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<script>
  const vscode = acquireVsCodeApi();
  function addSounds() { vscode.postMessage({ command: 'addSound' }); }
  function remove(fileName) { vscode.postMessage({ command: 'removeSound', fileName }); }
  function preview(fileName) { vscode.postMessage({ command: 'previewSound', fileName }); }
</script>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
