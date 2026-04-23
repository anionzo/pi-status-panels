# pi-status-panels

> Originally forked from [@alasano/pi-panels](https://github.com/alasano/house-of-pi/tree/master/packages/pi-panels) — rebuilt and maintained independently by [@anionzo](https://github.com/anionzo).

Responsive status panels rendered below the editor in [pi](https://pi.dev).

## Panels

### GIT
- Worktree name, branch, upstream tracking (shown only when non-default)
- Ahead/behind counts (`↑0 ↓0`)
- Staged changes: file count, insertions/deletions (`staged: 2 files (+10 -3)`)
- Unstaged changes: file count, insertions/deletions (`unstaged: 3 files (+15 -7)`)
- Untracked file count & stash count (shown only when > 0)

### INFO
- Context usage bar (color-coded green → red)
- Token breakdown: `↓input ↑output 💭thinking • cache • $cost ($cost/turn)`
- Provider & model: `anthropic │ Claude Sonnet 4 • high`

### SESSION
- Elapsed time since session start
- Session start time
- Turn count

Panels auto-size to their content, render side-by-side when terminal width allows, and fall back to a stacked layout on narrow terminals.

## Install

```bash
pi install npm:@anionzo/pi-status-panels
```

Or install from local path:

```bash
pi install /path/to/pi-status-panels
```

## Commands

| Command                  | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `/status-panels`         | Open the settings overlay to toggle panels and colors |
| `/status-panels on\|off` | Enable or disable all panels                          |

## Settings

Run `/status-panels` to open the settings overlay:

- **Show all panels** — master toggle
- **Git / Info / Session** — toggle individual panels
- **Border color** — panel frame color (blue, gold, green, cyan, magenta, red, white)
- **Text color** — label text color with bright/dim pair (blue, gold, green, cyan, magenta, red, white)

Preferences are persisted at `~/.pi/agent/state/extensions/status-panels/config.json`.

## Refresh behavior

- Git info & diff stats refresh every 5 seconds and immediately after each agent turn
- LLM context, tokens, and model info update on turn end and model switch
- Session timer ticks every 1 second

## Customization

To add a new panel:

1. Create a new file in `extensions/` (e.g. `my-panel.ts`)
2. Export a `buildMyPanel()` function following the pattern in `git.ts` or `session.ts`
3. Register it in `PANEL_DEFS` in `index.ts`
4. Add rendering logic in `buildAllPanels()`

## Requirements

- Pi interactive mode (panels use the widget API)

## License

MIT
