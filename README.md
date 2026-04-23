# pi-status-panels

Responsive status panels rendered below the editor in [pi](https://pi.dev).

Forked from [@alasano/pi-panels](https://github.com/anionzo/house-of-pi/tree/master/packages/pi-panels) with customizations.

## Panels

- **GIT** - worktree name, branch, upstream tracking, ahead/behind counts
- **INFO** - LLM context usage bar (color-coded), active model and thinking level
- **NOW PLAYING** - Spotify track, artist, and progress bar (macOS only)

Panels auto-size to their content, render side-by-side when terminal width allows, and fall back to a stacked layout on narrow terminals.

## Install

```bash
pi install npm:@anionzo/pi-status-panels
```

## Commands

| Command                  | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `/status-panels`         | Open the settings overlay to toggle individual panels |
| `/status-panels on\|off` | Enable or disable all panels                          |

## Customization

To add a new panel:

1. Create a new file in `extensions/` (e.g. `my-panel.ts`)
2. Export a `buildMyPanel()` function following the pattern in `git.ts` or `info.ts`
3. Register it in `PANEL_DEFS` in `index.ts`
4. Add rendering logic in `buildTopBlock()` / `renderPanels()`

## Requirements

- macOS (Spotify integration uses osascript/AppleScript)
- Pi interactive mode

## Credits

Based on [pi-panels](https://github.com/anionzo/house-of-pi/tree/master/packages/pi-panels) by [@alasano](https://github.com/alasano).

## License

MIT
