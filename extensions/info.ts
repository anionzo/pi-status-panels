import { truncateToWidth } from '@mariozechner/pi-tui';
import {
  GREEN_DARK_FG,
  GREEN_FG,
  clamp,
  formatCompactTokens,
  tint,
  usageColor,
  visibleWidth,
} from './utils';
import {
  computePanelWidths,
  framePanelBody,
  renderRow,
  SEPARATOR_WIDTH,
  type BuiltPanel,
} from './panel';

export type InfoSnapshot = {
  percent: number | null;
  tokens: number | null;
  contextWindow: number;
  modelText: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalCost: number;
};

type InfoRow = {
  label: string;
  labelColor: string;
  renderValue: (valueWidth: number) => string;
  measure: number;
};

function renderBar(percent: number | null, valueWidth: number): string {
  const safePercent = clamp(percent ?? 0, 0, 100);
  const pctText = `${Math.round(safePercent)}%`;

  const desiredBar = 20;
  const minBar = 6;
  const barWidth = Math.max(minBar, Math.min(desiredBar, valueWidth - pctText.length - 1));
  const filled = Math.round((safePercent / 100) * barWidth);

  const color = usageColor(percent);
  const fill = tint('█'.repeat(Math.max(0, filled)), color);
  const empty = '░'.repeat(Math.max(0, barWidth - filled));

  const composed = `${fill}${empty} ${tint(pctText, color)}`;
  const deficit = valueWidth - visibleWidth(composed);
  return deficit > 0 ? `${composed}${' '.repeat(deficit)}` : composed;
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function buildInfoPanel(snapshot: InfoSnapshot, maxInner: number): BuiltPanel {
  const contextTopRight = formatCompactTokens(snapshot.contextWindow);

  const inputText = formatCompactTokens(snapshot.inputTokens);
  const outputText = formatCompactTokens(snapshot.outputTokens);
  const tokensIOText = `↓${inputText} ↑${outputText}`;

  const cacheText =
    snapshot.cacheRead > 0 || snapshot.cacheWrite > 0
      ? `R:${formatCompactTokens(snapshot.cacheRead)} W:${formatCompactTokens(snapshot.cacheWrite)}`
      : '';

  const costText = formatCost(snapshot.totalCost);

  const rows: InfoRow[] = [
    {
      label: 'context',
      labelColor: GREEN_FG,
      measure: 20 + 1 + `${Math.round(snapshot.percent ?? 0)}%`.length,
      renderValue: (valueWidth) => renderBar(snapshot.percent, valueWidth),
    },
    {
      label: 'tokens',
      labelColor: GREEN_DARK_FG,
      measure: tokensIOText.length,
      renderValue: (valueWidth) => truncateToWidth(tokensIOText, valueWidth, '…', true),
    },
  ];

  if (cacheText) {
    rows.push({
      label: 'cache',
      labelColor: GREEN_DARK_FG,
      measure: cacheText.length,
      renderValue: (valueWidth) => truncateToWidth(cacheText, valueWidth, '…', true),
    });
  }

  rows.push(
    {
      label: 'cost',
      labelColor: GREEN_DARK_FG,
      measure: costText.length,
      renderValue: (valueWidth) => truncateToWidth(costText, valueWidth, '…', true),
    },
    {
      label: 'model',
      labelColor: GREEN_DARK_FG,
      measure: snapshot.modelText.length,
      renderValue: (valueWidth) => truncateToWidth(snapshot.modelText, valueWidth, '…', true),
    },
  );

  const labelWidth = rows.reduce((max, row) => Math.max(max, row.label.length), 0);

  const naturalContentWidth = rows.reduce(
    (max, row) => Math.max(max, labelWidth + SEPARATOR_WIDTH + row.measure),
    0,
  );

  const { inner, contentWidth } = computePanelWidths({
    title: 'INFO',
    rightText: contextTopRight,
    naturalContentWidth,
    maxInner,
    minInner: 24,
  });

  return framePanelBody({
    title: 'INFO',
    rightText: contextTopRight,
    bodyLines: rows.map((entry) =>
      renderRow(entry.label, entry.labelColor, labelWidth, contentWidth, entry.renderValue),
    ),
    inner,
    contentWidth,
  });
}
