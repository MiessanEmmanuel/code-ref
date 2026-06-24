# Code Ref

Plays a random sound every time a new bug appears in your code.

## Features

- Detects new errors in real time (TypeScript, ESLint, Python, and more)
- Plays a random sound from your personal library
- **Community tab**: browse and download sounds validated by the author
- Supports audio files (MP3, WAV, OGG) and video files (MP4, MOV…) — videos are automatically converted to audio (first 17 seconds)

## Usage

1. Open the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run **Code Ref: Manage Sounds**
3. Add your own sounds or browse the Community tab
4. Write buggy code — enjoy the sound

## Commands

| Command | Description |
|---|---|
| `Code Ref: Manage Sounds` | Open the sound manager |
| `Code Ref: Toggle On/Off` | Enable or disable sound alerts |

## Settings

| Setting | Default | Description |
|---|---|---|
| `codeRef.enabled` | `true` | Enable or disable the extension |
| `codeRef.volume` | `0.8` | Playback volume (0.0 to 1.0) |
| `codeRef.cooldownMs` | `1000` | Minimum ms between two sounds |
| `codeRef.triggerOn` | `["error"]` | Severity levels that trigger a sound |
