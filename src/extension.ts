import * as vscode from "vscode";
import * as path from "path";
import { SoundPlayer } from "./soundPlayer";
import { DiagnosticWatcher } from "./diagnosticWatcher";
import { AdminPanel } from "./adminPanel";

export function activate(context: vscode.ExtensionContext): void {
  const soundsDir = path.join(context.globalStorageUri.fsPath, "sounds");
  const player = new SoundPlayer(soundsDir);
  const watcher = new DiagnosticWatcher(player);
  const admin = new AdminPanel(context, player);

  // Status bar item: appears only while a sound is playing, click to stop.
  const stopItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  stopItem.text = "$(debug-stop) Stop sound";
  stopItem.tooltip = "Code Ref: stop the current sound";
  stopItem.command = "codeRef.stop";

  player.onStateChange((state) => {
    if (state.playing) {
      stopItem.show();
    } else {
      stopItem.hide();
    }
  });

  context.subscriptions.push(
    stopItem,

    vscode.commands.registerCommand("codeRef.manageSounds", () => {
      admin.show();
    }),

    vscode.commands.registerCommand("codeRef.stop", () => {
      player.stop();
    }),

    vscode.commands.registerCommand("codeRef.toggle", () => {
      const config = vscode.workspace.getConfiguration("codeRef");
      const current = config.get<boolean>("enabled", true);
      config.update("enabled", !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `Code Ref is now ${!current ? "enabled" : "disabled"}.`
      );
    }),

    { dispose: () => watcher.dispose() }
  );
}

export function deactivate(): void {}
