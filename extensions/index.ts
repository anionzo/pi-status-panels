import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ExtensionAPI, ExtensionContext } from '@mariozechner/pi-coding-agent';
import { getAgentDir, getSettingsListTheme } from '@mariozechner/pi-coding-agent';
import {
  decodeKittyPrintable,
  matchesKey,
  parseKey,
  type SettingItem,
  SettingsList,
  truncateToWidth,
} from '@mariozechner/pi-tui';
import { buildGitPanel, EMPTY_GIT_STATE, type GitInfo } from './git';
import { buildInfoPanel, type InfoSnapshot } from './info';
import { buildSessionPanel, type SessionSnapshot } from './session';
import { framePanelBody } from './panel';
import { maxVisibleWidth, padVisible, visibleWidth, setBorderColor, setTextColor, COLOR_NAMES, type ColorName } from './utils';

const SETTINGS_OVERLAY_MAX_INNER = 56;

function computeSettingsOverlayInner(bodyLines: string[], availableWidth: number): number {
  const maxInner = Math.max(24, Math.min(availableWidth - 2, SETTINGS_OVERLAY_MAX_INNER));
  return Math.max(
    24,
    Math.min(maxInner, Math.max(maxVisibleWidth(bodyLines), visibleWidth('─ STATUS PANELS ')) + 2),
  );
}

function getPrintableTypingKey(data: string): string | undefined {
  const kittyPrintable = decodeKittyPrintable(data);
  if (kittyPrintable && kittyPrintable !== ' ') {
    return kittyPrintable;
  }

  const parsed = parseKey(data);
  if (parsed && parsed.length === 1 && parsed !== ' ') {
    return parsed;
  }

  if (data.length === 1 && data !== ' ' && /^[\x21-\x7E]$/.test(data)) {
    return data;
  }

  return undefined;
}

const WIDGET_ID = 'status-panels';
const REFRESH_MS = 5000;
const TICK_MS = 1000;
const GAP = ' ';
const CONFIG_PATH = join(getAgentDir(), 'state', 'extensions', 'status-panels', 'config.json');

const PANEL_DEFS = [
  { id: 'git', label: 'Git', defaultEnabled: true },
  { id: 'info', label: 'Info', defaultEnabled: true },
  { id: 'session', label: 'Session', defaultEnabled: true },
] as const;

type PanelId = (typeof PANEL_DEFS)[number]['id'];
type PanelState = Record<PanelId, boolean>;

type StatusPanelsConfig = {
  enabled: boolean;
  panels: PanelState;
  borderColor: ColorName;
  textColor: ColorName;
};

function createPanelState(enabled: boolean): PanelState {
  return PANEL_DEFS.reduce((panels, panel) => {
    panels[panel.id] = enabled;
    return panels;
  }, {} as PanelState);
}

function createDefaultConfig(): StatusPanelsConfig {
  return {
    enabled: true,
    panels: createPanelState(true),
    borderColor: 'blue',
    textColor: 'green',
  };
}

function normalizeConfig(raw: unknown): StatusPanelsConfig {
  const defaults = createDefaultConfig();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults;
  }

  const input = raw as { enabled?: unknown; panels?: Record<string, unknown>; borderColor?: unknown; textColor?: unknown };
  const panels = { ...defaults.panels };

  for (const panel of PANEL_DEFS) {
    const value = input.panels?.[panel.id];
    if (typeof value === 'boolean') {
      panels[panel.id] = value;
    }
  }

  const borderColor = typeof input.borderColor === 'string' && COLOR_NAMES.includes(input.borderColor as ColorName)
    ? (input.borderColor as ColorName)
    : defaults.borderColor;

  const textColor = typeof input.textColor === 'string' && COLOR_NAMES.includes(input.textColor as ColorName)
    ? (input.textColor as ColorName)
    : defaults.textColor;

  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : defaults.enabled,
    panels,
    borderColor,
    textColor,
  };
}

function loadConfig(): StatusPanelsConfig {
  if (!existsSync(CONFIG_PATH)) {
    return createDefaultConfig();
  }

  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    return normalizeConfig(raw);
  } catch (error) {
    console.error(`Failed to load status panels config from ${CONFIG_PATH}:`, error);
    return createDefaultConfig();
  }
}

function saveConfig(config: StatusPanelsConfig): boolean {
  try {
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    return true;
  } catch (error) {
    console.error(`Failed to save status panels config to ${CONFIG_PATH}:`, error);
    return false;
  }
}

function parseCount(raw: string): { behind: number; ahead: number } {
  const [behindRaw, aheadRaw] = raw.trim().split(/\s+/);
  return {
    behind: Number.parseInt(behindRaw || '0', 10) || 0,
    ahead: Number.parseInt(aheadRaw || '0', 10) || 0,
  };
}

function combineSideBySide(left: string[], leftWidth: number, right: string[]): string[] {
  const rows = Math.max(left.length, right.length);
  const output: string[] = [];

  for (let i = 0; i < rows; i++) {
    const l = left[i] ?? ' '.repeat(leftWidth);
    const r = right[i] ?? '';
    output.push(`${padVisible(l, leftWidth)}${GAP}${r}`);
  }

  return output;
}

export default function statusPanelsExtension(pi: ExtensionAPI) {
  let ctxRef: ExtensionContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let config = loadConfig();
  let lastGitRefreshAt = 0;

  let gitState: GitInfo = EMPTY_GIT_STATE;

  let infoState: InfoSnapshot = {
    percent: null,
    tokens: null,
    contextWindow: 0,
    modelText: '(no model)',
    modelLabel: 'model',
    inputTokens: 0,
    outputTokens: 0,
    cacheRead: 0,
    totalCost: 0,
  };

  let sessionState: SessionSnapshot = {
    startedAt: Date.now(),
    elapsed: 0,
    turnCount: 0,
  };

  function isPanelEnabled(panelId: PanelId): boolean {
    return config.panels[panelId];
  }

  function checkboxValue(enabled: boolean): string {
    return enabled ? '[x]' : '[ ]';
  }

  function persistConfig(ctx?: ExtensionContext): boolean {
    const ok = saveConfig(config);
    if (!ok && ctx?.hasUI) {
      ctx.ui.notify('Failed to save status panels preferences', 'error');
    }
    return ok;
  }

  function applyConfig(ctx?: ExtensionContext) {
    if (ctx) ctxRef = ctx;
    setBorderColor(config.borderColor);
    setTextColor(config.textColor);

    if (!config.enabled) {
      stop();
      return;
    }

    stop();
    start();
  }

  function setMasterEnabled(nextEnabled: boolean, ctx?: ExtensionContext) {
    config = {
      enabled: nextEnabled,
      panels: createPanelState(nextEnabled),
      borderColor: config.borderColor,
      textColor: config.textColor,
    };
    persistConfig(ctx);
    applyConfig(ctx);
  }

  function setPanelEnabled(panelId: PanelId, nextEnabled: boolean, ctx?: ExtensionContext) {
    config = {
      ...config,
      panels: {
        ...config.panels,
        [panelId]: nextEnabled,
      },
    };
    persistConfig(ctx);
    applyConfig(ctx);
  }

  function setBorderColorConfig(color: ColorName, ctx?: ExtensionContext) {
    config = {
      ...config,
      borderColor: color,
    };
    setBorderColor(color);
    persistConfig(ctx);
    renderPanels();
  }

  function setTextColorConfig(color: ColorName, ctx?: ExtensionContext) {
    config = {
      ...config,
      textColor: color,
    };
    setTextColor(color);
    persistConfig(ctx);
    renderPanels();
  }

  async function runGit(args: string[]): Promise<string | undefined> {
    try {
      const result = await pi.exec('git', args, { timeout: 2000 });
      if (result.code !== 0) return undefined;
      const value = result.stdout.trim();
      return value || undefined;
    } catch {
      return undefined;
    }
  }

  async function readGitInfo(): Promise<GitInfo> {
    const inside = await runGit(['rev-parse', '--is-inside-work-tree']);
    if (inside !== 'true') {
      return EMPTY_GIT_STATE;
    }

    const topLevel = (await runGit(['rev-parse', '--show-toplevel'])) || '-';
    const worktree = topLevel.split('/').filter(Boolean).pop() || topLevel;

    const branch =
      (await runGit(['branch', '--show-current'])) ||
      (await runGit(['rev-parse', '--short', 'HEAD'])) ||
      '(detached)';

    const upstream = await runGit([
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{upstream}',
    ]);

    if (!upstream) {
      const diffStats = await parseDiffStats();
      return {
        inRepo: true,
        worktree,
        branch,
        tracking: '(no upstream)',
        ahead: 0,
        behind: 0,
        ...diffStats,
      };
    }

    const countsRaw = await runGit(['rev-list', '--left-right', '--count', `${upstream}...HEAD`]);
    const { behind, ahead } = parseCount(countsRaw || '0 0');
    const diffStats = await parseDiffStats();

    return {
      inRepo: true,
      worktree,
      branch,
      tracking: upstream,
      ahead,
      behind,
      ...diffStats,
    };
  }

  async function parseDiffStats(): Promise<{ insertions: number; deletions: number }> {
    const raw = await runGit(['diff', '--shortstat']);
    if (!raw) return { insertions: 0, deletions: 0 };

    const insMatch = raw.match(/(\d+) insertion/);
    const delMatch = raw.match(/(\d+) deletion/);
    return {
      insertions: insMatch ? Number.parseInt(insMatch[1], 10) : 0,
      deletions: delMatch ? Number.parseInt(delMatch[1], 10) : 0,
    };
  }

  function readInfoState(ctx: ExtensionContext): InfoSnapshot {
    const usage = ctx.getContextUsage();

    const provider = ctx.model?.provider || 'model';
    const modelName = ctx.model?.name || ctx.model?.id || '(no model)';
    const thinking = pi.getThinkingLevel();

    const modelLabel = provider;
    const modelValue = `${modelName} • ${thinking}`;

    // Aggregate token stats from session entries
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheRead = 0;
    let totalCost = 0;

    try {
      const branch = ctx.sessionManager.getBranch();
      for (const entry of branch) {
        if (entry.type === 'message' && entry.message.role === 'assistant') {
          const msg = entry.message as any;
          if (msg.usage) {
            inputTokens += msg.usage.input || 0;
            outputTokens += msg.usage.output || 0;
            cacheRead += msg.usage.cacheRead || 0;
            if (msg.usage.cost) {
              totalCost += msg.usage.cost.total || 0;
            }
          }
        }
      }
    } catch {
      // Session may not be ready yet
    }

    return {
      percent: usage?.percent ?? null,
      tokens: usage?.tokens ?? null,
      contextWindow: usage?.contextWindow ?? 0,
      modelText: modelValue,
      modelLabel,
      inputTokens,
      outputTokens,
      cacheRead,
      totalCost,
    };
  }

  function updateSessionElapsed() {
    sessionState = {
      ...sessionState,
      elapsed: Date.now() - sessionState.startedAt,
    };
  }

  function buildAllPanels(safeWidth: number): string[] {
    const topPanels: Array<{ lines: string[]; width: number }> = [];

    if (isPanelEnabled('git')) {
      topPanels.push(buildGitPanel(gitState, safeWidth - 2));
    }

    if (isPanelEnabled('info')) {
      topPanels.push(buildInfoPanel(infoState, safeWidth - 2));
    }

    // Build top row (git + info side by side)
    let topBlock: string[] = [];
    if (topPanels.length === 1) {
      topBlock = topPanels[0]!.lines;
    } else if (topPanels.length === 2) {
      const [first, second] = topPanels;
      const naturalCombined = first!.width + visibleWidth(GAP) + second!.width;
      if (naturalCombined <= safeWidth) {
        topBlock = combineSideBySide(first!.lines, first!.width, second!.lines);
      } else {
        const leftOuterTarget = Math.max(28, Math.floor((safeWidth - visibleWidth(GAP)) * 0.55));
        const rightOuterTarget = Math.max(28, safeWidth - visibleWidth(GAP) - leftOuterTarget);

        const gitCompact = buildGitPanel(gitState, Math.max(24, leftOuterTarget - 2));
        const infoCompact = buildInfoPanel(infoState, Math.max(24, rightOuterTarget - 2));

        const compactCombined = gitCompact.width + visibleWidth(GAP) + infoCompact.width;
        if (compactCombined <= safeWidth) {
          topBlock = combineSideBySide(gitCompact.lines, gitCompact.width, infoCompact.lines);
        } else {
          topBlock = [...first!.lines, ...second!.lines];
        }
      }
    }

    // Build session panel
    if (!isPanelEnabled('session')) {
      return topBlock;
    }

    const sessionPanel = buildSessionPanel(sessionState, safeWidth - 2);

    if (topBlock.length === 0) {
      return sessionPanel.lines;
    }

    const topWidth = maxVisibleWidth(topBlock);
    const gapWidth = visibleWidth(GAP);

    // Try side by side with top block
    if (topWidth + gapWidth + sessionPanel.width <= safeWidth) {
      return combineSideBySide(topBlock, topWidth, sessionPanel.lines);
    }

    // Try compact session
    const availableForSession = safeWidth - topWidth - gapWidth;
    if (availableForSession >= 26) {
      const sessionCompact = buildSessionPanel(
        sessionState,
        Math.max(22, availableForSession - 2),
      );
      if (topWidth + gapWidth + sessionCompact.width <= safeWidth) {
        return combineSideBySide(topBlock, topWidth, sessionCompact.lines);
      }
    }

    // Stack vertically
    return [...topBlock, ...sessionPanel.lines];
  }

  function renderPanels() {
    if (!config.enabled || !ctxRef?.hasUI) return;

    ctxRef.ui.setWidget(
      WIDGET_ID,
      (_tui, _theme) => ({
        invalidate() {},
        render(width: number) {
          const safeWidth = Math.max(1, width);
          return buildAllPanels(safeWidth).map((line) => truncateToWidth(line, safeWidth));
        },
      }),
      { placement: 'belowEditor' },
    );
  }

  async function refreshCore(force = false) {
    if (!ctxRef) return;
    const now = Date.now();
    if (!force && now - lastGitRefreshAt < REFRESH_MS) return;

    gitState = await readGitInfo();
    infoState = readInfoState(ctxRef);
    lastGitRefreshAt = now;
  }

  async function tick(forceCore = false) {
    if (!config.enabled || !ctxRef?.hasUI) return;

    updateSessionElapsed();
    await refreshCore(forceCore);
    renderPanels();
  }

  function start() {
    if (!config.enabled || !ctxRef?.hasUI) return;
    if (timer) return;

    void tick(true);
    timer = setInterval(() => {
      void tick(false);
    }, TICK_MS);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    if (ctxRef?.hasUI) {
      ctxRef.ui.setWidget(WIDGET_ID, undefined);
    }
  }

  async function showSettingsOverlay(ctx: ExtensionContext): Promise<void> {
    ctxRef = ctx;

    const items: SettingItem[] = [
      {
        id: 'enabled',
        label: 'Show all panels',
        currentValue: checkboxValue(config.enabled),
        values: ['[x]', '[ ]'],
      },
      ...PANEL_DEFS.map((panel) => ({
        id: panel.id,
        label: panel.label,
        currentValue: checkboxValue(isPanelEnabled(panel.id)),
        values: ['[x]', '[ ]'],
      })),
      {
        id: 'borderColor',
        label: 'Border color',
        currentValue: config.borderColor,
        values: [...COLOR_NAMES],
      },
      {
        id: 'textColor',
        label: 'Text color',
        currentValue: config.textColor,
        values: [...COLOR_NAMES],
      },
    ];

    const settingsTheme = getSettingsListTheme();
    const maxVisibleItems = Math.min(items.length + 2, 10);
    const probeList = new SettingsList(
      items,
      maxVisibleItems,
      settingsTheme,
      () => {},
      () => {},
    );
    const probeLines = probeList.render(Math.max(8, SETTINGS_OVERLAY_MAX_INNER - 2));
    const overlayBodyLines = ['Choose which panels are visible', '', ...probeLines];
    const overlayWidth =
      computeSettingsOverlayInner(overlayBodyLines, SETTINGS_OVERLAY_MAX_INNER + 2) + 2;

    await ctx.ui.custom(
      (_tui, theme, _kb, done) => {
        const settingsList = new SettingsList(
          items,
          maxVisibleItems,
          settingsTheme,
          (id, newValue) => {
            if (id === 'borderColor') {
              setBorderColorConfig(newValue as ColorName, ctx);
              return;
            }

            if (id === 'textColor') {
              setTextColorConfig(newValue as ColorName, ctx);
              return;
            }

            const nextEnabled = newValue === '[x]';
            if (id === 'enabled') {
              setMasterEnabled(nextEnabled, ctx);
              for (const panel of PANEL_DEFS) {
                settingsList.updateValue(panel.id, checkboxValue(nextEnabled));
              }
              return;
            }

            setPanelEnabled(id as PanelId, nextEnabled, ctx);
          },
          () => done(undefined),
        );

        return {
          render(width: number) {
            const safeWidth = Math.max(24, width);
            const provisionalInner = Math.max(
              24,
              Math.min(safeWidth - 2, SETTINGS_OVERLAY_MAX_INNER),
            );
            const listLines = settingsList.render(Math.max(8, provisionalInner - 2));
            const bodyLines = [
              theme.fg('muted', 'Choose which panels are visible'),
              '',
              ...listLines,
            ];
            const naturalInner = computeSettingsOverlayInner(bodyLines, safeWidth);

            return framePanelBody({
              title: 'STATUS PANELS',
              bodyLines,
              inner: naturalInner,
            }).lines;
          },
          invalidate() {
            settingsList.invalidate();
          },
          handleInput(data: string) {
            const printableKey = getPrintableTypingKey(data);
            if (
              printableKey &&
              !matchesKey(data, 'escape') &&
              !matchesKey(data, 'return') &&
              !matchesKey(data, 'up') &&
              !matchesKey(data, 'down') &&
              !matchesKey(data, 'left') &&
              !matchesKey(data, 'right')
            ) {
              done(undefined);
              queueMicrotask(() => ctx.ui.pasteToEditor(printableKey));
              return;
            }

            settingsList.handleInput?.(data);
          },
        };
      },
      {
        overlay: true,
        overlayOptions: {
          anchor: 'center',
          width: overlayWidth,
        },
      },
    );
  }

  pi.registerCommand('status-panels', {
    description: 'Open status panel settings, or use /status-panels [on|off]',
    handler: async (args, ctx) => {
      ctxRef = ctx;
      const mode = (args || '').trim().toLowerCase();

      if (mode === '' || mode === 'settings') {
        await showSettingsOverlay(ctx);
        return;
      }

      if (!['on', 'off'].includes(mode)) {
        ctx.ui.notify('Usage: /status-panels [on|off]', 'warning');
        return;
      }

      const nextEnabled = mode === 'on';
      setMasterEnabled(nextEnabled, ctx);
      ctx.ui.notify(nextEnabled ? 'Status panels visible' : 'Status panels hidden', 'info');
    },
  });

  pi.on('session_start', async (_event, ctx) => {
    config = loadConfig();
    sessionState = { startedAt: Date.now(), elapsed: 0, turnCount: 0 };
    applyConfig(ctx);
  });

  pi.on('session_switch', async (_event, ctx) => {
    config = loadConfig();
    sessionState = { startedAt: Date.now(), elapsed: 0, turnCount: 0 };
    applyConfig(ctx);
  });

  pi.on('turn_end', async (_event, ctx) => {
    ctxRef = ctx;
    sessionState = {
      ...sessionState,
      turnCount: sessionState.turnCount + 1,
    };
    if (!config.enabled) return;
    void tick(true);
  });

  pi.on('model_select', async (_event, ctx) => {
    ctxRef = ctx;
    if (!config.enabled) return;
    infoState = readInfoState(ctx);
    renderPanels();
  });

  pi.on('session_shutdown', async (_event, ctx) => {
    ctxRef = ctx;
    stop();
  });
}
