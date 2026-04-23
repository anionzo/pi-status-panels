# Changelog

## 0.4.0

### New: SYSTEM panel
- **CPU usage** bar (delta-based, accurate)
- **RAM usage** bar with used/total GB
- **GPU utilization** via `nvidia-smi` (auto-detected, NVIDIA only)
- **VRAM usage** shown when GPU detected

### Git panel
- **Staged vs unstaged** diff stats shown separately with file counts
- **Untracked files** count (shown only when > 0)
- **Stash count** (shown only when > 0)
- Moved insertions/deletions from title bar into a dedicated `changes` row for clarity

### Info panel
- **Thinking tokens** shown separately (`💭N`) when model uses extended thinking
- Removed cost/turn display

### Session panel
- **Average turn duration** shown after first turn
- **Output speed** (tok/s) calculated per turn

### Context warning
- **80% warning** — notification to consider compacting
- **90% critical** — notification that compaction is imminent
- Alerts fire once per session per threshold

### Fixes
- `package.json` description no longer references removed Spotify panel
- `pi.image` URL corrected to point to `anionzo/pi-status-panels` repo
- `git diff HEAD --shortstat` → split into `git diff --shortstat` (unstaged) and `git diff --cached --shortstat` (staged)

### Docs
- README expanded with detailed panel descriptions, settings reference, and refresh behavior section

## 0.3.0

- **INFO panel**: token I/O breakdown (↓input ↑output), cache read/write stats, session cost
- **Settings**: customizable border color (blue, gold, green, cyan, magenta, red, white)
- Border rendering refactored to use dynamic `border()` function

## 0.2.0

- Added **Session** panel (elapsed time, start time, turn count)
- Added **token count** row to Info panel
- Removed Spotify/Now Playing panel (macOS-only, not needed)
- Tick interval changed from 250ms to 1000ms (no more Spotify polling)
- Cross-platform support (no osascript dependency)

## 0.1.0

- Forked from [@alasano/pi-panels](https://github.com/alasano/house-of-pi/tree/master/packages/pi-panels)
- Restructured as standalone repo under `@anionzo/pi-status-panels`
