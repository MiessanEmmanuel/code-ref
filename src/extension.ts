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

  context.subscriptions.push(
    vscode.commands.registerCommand("soundIvory.manageSounds", () => {
      admin.show();
    }),

    vscode.commands.registerCommand("soundIvory.toggle", () => {
      const config = vscode.workspace.getConfiguration("soundIvory");
      const current = config.get<boolean>("enabled", true);
      config.update("enabled", !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `Sound Ivory is now ${!current ? "enabled" : "disabled"}.`
      );
    }),

    { dispose: () => watcher.dispose() }
  );
}

export function deactivate(): void {}
