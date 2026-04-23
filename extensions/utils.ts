import { visibleWidth } from '@mariozechner/pi-tui';

export { visibleWidth };

export const GOLD_FG = '\x1b[38;2;212;162;46m';
export const BLUE_FG = '\x1b[38;2;86;156;214m';
export const GREEN_FG = '\x1b[38;2;96;176;88m';
export const GREEN_DARK_FG = '\x1b[38;2;62;124;66m';
export const CYAN_FG = '\x1b[38;2;78;201;176m';
export const MAGENTA_FG = '\x1b[38;2;198;120;221m';
export const RED_FG = '\x1b[38;2;224;108;117m';
export const WHITE_FG = '\x1b[38;2;200;200;200m';
export const RESET_FG = '\x1b[39m';

export type BorderColorName = 'blue' | 'gold' | 'green' | 'cyan' | 'magenta' | 'red' | 'white';

export const BORDER_COLORS: Record<BorderColorName, string> = {
  blue: BLUE_FG,
  gold: GOLD_FG,
  green: GREEN_FG,
  cyan: CYAN_FG,
  magenta: MAGENTA_FG,
  red: RED_FG,
  white: WHITE_FG,
};

export const BORDER_COLOR_NAMES: BorderColorName[] = ['blue', 'gold', 'green', 'cyan', 'magenta', 'red', 'white'];

let currentBorderColor: string = BLUE_FG;

export function setBorderColor(color: BorderColorName) {
  currentBorderColor = BORDER_COLORS[color] || BLUE_FG;
}

export function getBorderColor(): string {
  return currentBorderColor;
}

export function tint(text: string, color: string): string {
  return `${color}${text}${RESET_FG}`;
}

export function border(text: string): string {
  return tint(text, currentBorderColor);
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
