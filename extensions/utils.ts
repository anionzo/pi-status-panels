import { visibleWidth } from '@mariozechner/pi-tui';

export { visibleWidth };

export const RESET_FG = '\x1b[39m';

// ── Color palette ──────────────────────────────────────────────────────
export type ColorName = 'blue' | 'gold' | 'green' | 'cyan' | 'magenta' | 'red' | 'white';

export const COLOR_NAMES: ColorName[] = ['blue', 'gold', 'green', 'cyan', 'magenta', 'red', 'white'];

interface ColorPair {
  bright: string;
  dim: string;
}

const COLOR_PAIRS: Record<ColorName, ColorPair> = {
  blue:    { bright: '\x1b[38;2;86;156;214m',  dim: '\x1b[38;2;55;100;140m'  },
  gold:    { bright: '\x1b[38;2;212;162;46m',   dim: '\x1b[38;2;140;108;34m'  },
  green:   { bright: '\x1b[38;2;96;176;88m',    dim: '\x1b[38;2;62;124;66m'   },
  cyan:    { bright: '\x1b[38;2;78;201;176m',   dim: '\x1b[38;2;48;130;115m'  },
  magenta: { bright: '\x1b[38;2;198;120;221m',  dim: '\x1b[38;2;130;78;148m'  },
  red:     { bright: '\x1b[38;2;224;108;117m',  dim: '\x1b[38;2;150;72;78m'   },
  white:   { bright: '\x1b[38;2;210;210;210m',  dim: '\x1b[38;2;140;140;140m' },
};

// ── Dynamic border color ───────────────────────────────────────────────
let currentBorderColor: string = COLOR_PAIRS.blue.bright;

export function setBorderColor(color: ColorName) {
  currentBorderColor = (COLOR_PAIRS[color] || COLOR_PAIRS.blue).bright;
}

export function border(text: string): string {
  return tint(text, currentBorderColor);
}

// ── Dynamic text (label) color ─────────────────────────────────────────
let currentLabelBright: string = COLOR_PAIRS.green.bright;
let currentLabelDim: string = COLOR_PAIRS.green.dim;

export function setTextColor(color: ColorName) {
  const pair = COLOR_PAIRS[color] || COLOR_PAIRS.green;
  currentLabelBright = pair.bright;
  currentLabelDim = pair.dim;
}

export function labelBright(): string {
  return currentLabelBright;
}

export function labelDim(): string {
  return currentLabelDim;
}

// ── Shared helpers ─────────────────────────────────────────────────────
export function tint(text: string, color: string): string {
  return `${color}${text}${RESET_FG}`;
}

export function padVisible(text: string, width: number): string {
  const deficit = width - visibleWidth(text);
  if (deficit <= 0) return text;
  return `${text}${' '.repeat(deficit)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function formatCompactTokens(tokens: number | null | undefined): string {
  if (tokens == null || Number.isNaN(tokens)) return '?';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}k`;
  return `${tokens}`;
}

export function usageColor(percent: number | null): string {
  if (percent == null) return '\x1b[38;2;160;160;160m';
  if (percent < 40) return '\x1b[38;2;88;172;98m'; // green
  if (percent < 60) return '\x1b[38;2;145;182;78m'; // lime
  if (percent < 75) return '\x1b[38;2;213;176;68m'; // yellow
  if (percent < 90) return '\x1b[38;2;214;140;52m'; // orange
  return '\x1b[38;2;200;84;74m'; // red
}

export function maxVisibleWidth(lines: string[]): number {
  return lines.reduce((max, line) => Math.max(max, visibleWidth(line)), 0);
}
