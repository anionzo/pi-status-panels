import { truncateToWidth } from '@mariozechner/pi-tui';
import {
  labelBright,
  labelDim,
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
  // Header right: context window + %
  const pctStr = snapshot.percent != null ? `${Math.round(snapshot.percent)}%` : '?%';
  const contextTopRight = `${formatCompactTokens(snapshot.contextWindow)} ${pctStr}`;

  // Tokens line: ↓input ↑output • cache 45k • $0.15
  const inputText = formatCompactTokens(snapshot.inputTokens);
  const outputText = formatCompactTokens(snapshot.outputTokens);
  const parts: string[] = [`↓${inputText} ↑${outputText}`];

  if (snapshot.cacheRead > 0) {
    parts.push(`cache ${formatCompactTokens(snapshot.cacheRead)}`);
  }

  parts.push(formatCost(snapshot.totalCost));

  const tokensLine = parts.join(' • ');

  // 3 rows: context bar, tokens + cost, model
  const rows: InfoRow[] = [
    {
      label: 'context',
      labelColor: labelBright(),
      measure: 20 + 1 + `${Math.round(snapshot.percent ?? 0)}%`.length,
      renderValue: (valueWidth) => renderBar(snapshot.percent, valueWidth),
    },
    {
      label: 'tokens',
      labelColor: labelDim(),
      measure: tokensLine.length,
      renderValue: (valueWidth) => truncateToWidth(tokensLine, valueWidth, '…', true),
    },
    {
      label: 'model',
      labelColor: labelDim(),
      measure: snapshot.modelText.length,
      renderValue: (valueWidth) => truncateToWidth(snapshot.modelText, valueWidth, '…', true),
    },
  ];

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
    minInner: 34,
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
