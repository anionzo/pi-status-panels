# pi-status-panels

> Originally forked from [@alasano/pi-panels](https://github.com/alasano/house-of-pi/tree/master/packages/pi-panels) — rebuilt and maintained independently by [@anionzo](https://github.com/anionzo).

Responsive status panels rendered below the editor in [pi](https://pi.dev).

## Panels

- **GIT** — worktree name, branch, upstream tracking, ahead/behind counts
- **INFO** — LLM context usage bar (color-coded), token count, active model and thinking level
- **SESSION** — elapsed time, session start time, turn count

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
2. Export a `buildMyPanel()` function following the pattern in `git.ts` or `session.ts`
3. Register it in `PANEL_DEFS` in `index.ts`
4. Add rendering logic in `buildAllPanels()`

## Requirements

- Pi interactive mode (panels use the widget API)

## License

MIT
