import * as vscode from "vscode";
import { SoundPlayer } from "./soundPlayer";



export class DiagnosticWatcher {
  private disposable: vscode.Disposable;
  private previousErrorUris = new Map<string, number>();

  constructor(private player: SoundPlayer) {
    this.disposable = vscode.languages.onDidChangeDiagnostics((e) => {
      this.handleChange(e.uris);
    });
  }

  private handleChange(uris: readonly vscode.Uri[]): void {
    const config = vscode.workspace.getConfiguration("codeRef");
    if (!config.get<boolean>("enabled", true)) return;

    const triggerOn = config.get<string[]>("triggerOn", ["error"]);
    const severitySet = new Set(triggerOn);

    const severityMap: Record<string, vscode.DiagnosticSeverity> = {
      error: vscode.DiagnosticSeverity.Error,
      warning: vscode.DiagnosticSeverity.Warning,
      info: vscode.DiagnosticSeverity.Information,
      hint: vscode.DiagnosticSeverity.Hint,
    };

    const watchedSeverities = new Set(
      [...severitySet].map((k) => severityMap[k]).filter((v) => v !== undefined)
    );

    for (const uri of uris) {
      const diags = vscode.languages.getDiagnostics(uri);
      const count = diags.filter((d) => watchedSeverities.has(d.severity)).length;
      const previous = this.previousErrorUris.get(uri.toString()) ?? 0;

      if (count > previous) {
        const volume = config.get<number>("volume", 0.8);
        const cooldown = config.get<number>("cooldownMs", 1000);
        this.player.play(volume, cooldown);
        this.previousErrorUris.set(uri.toString(), count);
        return; // one sound per event batch
      }

      if (count === 0) {
        this.previousErrorUris.delete(uri.toString());
      } else {
        this.previousErrorUris.set(uri.toString(), count);
      }
    }
  }

  dispose(): void {
    this.disposable.dispose();
  }
}
