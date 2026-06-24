"use strict";var M=Object.create;var f=Object.defineProperty;var I=Object.getOwnPropertyDescriptor;var $=Object.getOwnPropertyNames;var F=Object.getPrototypeOf,E=Object.prototype.hasOwnProperty;var N=(t,e)=>{for(var o in e)f(t,o,{get:e[o],enumerable:!0})},x=(t,e,o,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of $(e))!E.call(t,n)&&n!==o&&f(t,n,{get:()=>e[n],enumerable:!(r=I(e,n))||r.enumerable});return t};var c=(t,e,o)=>(o=t!=null?M(F(t)):{},x(e||!t||!t.__esModule?f(o,"default",{value:t,enumerable:!0}):o,t)),U=t=>x(f({},"__esModule",{value:!0}),t);var O={};N(O,{activate:()=>A,deactivate:()=>j});module.exports=U(O);var d=c(require("vscode")),k=c(require("path"));var s=c(require("fs")),v=c(require("path")),g=require("child_process"),h=class{constructor(e){this.lastPlayedAt=0;this.soundsDir=e,s.existsSync(e)||s.mkdirSync(e,{recursive:!0})}getSounds(){return s.existsSync(this.soundsDir)?s.readdirSync(this.soundsDir).filter(e=>/\.(mp3|wav|ogg|aiff)$/i.test(e)):[]}play(e,o){let r=Date.now();if(r-this.lastPlayedAt<o)return;let n=this.getSounds();if(n.length===0)return;let p=n[Math.floor(Math.random()*n.length)],u=v.join(this.soundsDir,p);this.lastPlayedAt=r,this.playFile(u,e)}playFile(e,o){let r=process.platform;if(r==="darwin")(0,g.execFile)("afplay",["-v",String(o),e],()=>{});else if(r==="win32"){let n=`
        $player = New-Object System.Media.SoundPlayer;
        $player.SoundLocation = '${e}';
        $player.PlaySync();
      `;(0,g.execFile)("powershell",["-Command",n],()=>{})}else(0,g.execFile)("paplay",[e],n=>{n&&(0,g.execFile)("aplay",[e],()=>{})})}addSound(e){let o=v.basename(e),r=v.join(this.soundsDir,o);return s.copyFileSync(e,r),o}removeSound(e){let o=v.join(this.soundsDir,e);s.existsSync(o)&&s.unlinkSync(o)}};var i=c(require("vscode")),y=class{constructor(e){this.player=e;this.previousErrorUris=new Map;this.disposable=i.languages.onDidChangeDiagnostics(o=>{this.handleChange(o.uris)})}handleChange(e){let o=i.workspace.getConfiguration("soundIvory");if(!o.get("enabled",!0))return;let r=o.get("triggerOn",["error"]),n=new Set(r),p={error:i.DiagnosticSeverity.Error,warning:i.DiagnosticSeverity.Warning,info:i.DiagnosticSeverity.Information,hint:i.DiagnosticSeverity.Hint},u=new Set([...n].map(a=>p[a]).filter(a=>a!==void 0));for(let a of e){let m=i.languages.getDiagnostics(a).filter(w=>u.has(w.severity)).length,C=this.previousErrorUris.get(a.toString())??0;if(m>C){let w=o.get("volume",.8),P=o.get("cooldownMs",1e3);this.player.play(w,P),this.previousErrorUris.set(a.toString(),m);return}m===0?this.previousErrorUris.delete(a.toString()):this.previousErrorUris.set(a.toString(),m)}}dispose(){this.disposable.dispose()}};var l=c(require("vscode")),D=c(require("path")),b=class{constructor(e,o){this.context=e;this.player=o}show(){if(this.panel){this.panel.reveal();return}this.panel=l.window.createWebviewPanel("soundIvoryAdmin","Sound Ivory \u2014 Manage Sounds",l.ViewColumn.One,{enableScripts:!0}),this.panel.onDidDispose(()=>{this.panel=void 0}),this.panel.webview.onDidReceiveMessage(async e=>{switch(e.command){case"addSound":{let o=await l.window.showOpenDialog({canSelectMany:!0,filters:{Audio:["mp3","wav","ogg","aiff"]},title:"Select sound files"});if(o&&o.length>0){for(let r of o)this.player.addSound(r.fsPath);this.refresh()}break}case"removeSound":this.player.removeSound(e.fileName),this.refresh();break;case"previewSound":{let r=l.workspace.getConfiguration("soundIvory").get("volume",.8),n=D.join(this.context.globalStorageUri.fsPath,"sounds",e.fileName);this.player.playFile(n,r);break}}}),this.refresh()}refresh(){if(!this.panel)return;let e=this.player.getSounds();this.panel.webview.html=this.getHtml(e)}getHtml(e){let o=e.length===0?'<tr><td colspan="2" class="empty">No sounds yet. Click "Add Sounds" to get started.</td></tr>':e.map(r=>`
        <tr>
          <td class="name">${S(r)}</td>
          <td class="actions">
            <button onclick="preview('${S(r)}')">\u25B6 Preview</button>
            <button class="danger" onclick="remove('${S(r)}')">\u2715 Remove</button>
          </td>
        </tr>`).join("");return`<!DOCTYPE html>
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
<h1>\u{1F50A} Sound Ivory</h1>
<p class="sub">These sounds play randomly when a new bug appears in your code.</p>

<div class="toolbar">
  <button onclick="addSounds()">+ Add Sounds</button>
  <span class="count">${e.length} sound${e.length!==1?"s":""} loaded</span>
</div>

<table>
  <thead><tr><th>File name</th><th></th></tr></thead>
  <tbody>${o}</tbody>
</table>

<script>
  const vscode = acquireVsCodeApi();
  function addSounds() { vscode.postMessage({ command: 'addSound' }); }
  function remove(fileName) { vscode.postMessage({ command: 'removeSound', fileName }); }
  function preview(fileName) { vscode.postMessage({ command: 'previewSound', fileName }); }
</script>
</body>
</html>`}};function S(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function A(t){let e=k.join(t.globalStorageUri.fsPath,"sounds"),o=new h(e),r=new y(o),n=new b(t,o);t.subscriptions.push(d.commands.registerCommand("soundIvory.manageSounds",()=>{n.show()}),d.commands.registerCommand("soundIvory.toggle",()=>{let p=d.workspace.getConfiguration("soundIvory"),u=p.get("enabled",!0);p.update("enabled",!u,d.ConfigurationTarget.Global),d.window.showInformationMessage(`Sound Ivory is now ${u?"disabled":"enabled"}.`)}),{dispose:()=>r.dispose()})}function j(){}0&&(module.exports={activate,deactivate});
