# Changelog

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
