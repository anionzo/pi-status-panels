import { truncateToWidth } from '@mariozechner/pi-tui';
import { GREEN_DARK_FG, GREEN_FG } from './utils';
import {
  computePanelWidths,
  framePanelBody,
  renderRow,
  SEPARATOR_WIDTH,
  type BuiltPanel,
} from './panel';

export type SessionSnapshot = {
  startedAt: number;
  elapsed: number;
  turnCount: number;
};

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function formatStartTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

type SessionRow = {
  label: string;
  value: string;
  labelColor?: string;
};

export function buildSessionPanel(snapshot: SessionSnapshot, maxInner: number): BuiltPanel {
  const elapsedText = formatElapsed(snapshot.elapsed);
  const startText = formatStartTime(snapshot.startedAt);
  const turnText = `${snapshot.turnCount}`;

  const rows: SessionRow[] = [
    { label: 'elapsed', value: elapsedText, labelColor: GREEN_FG },
    { label: 'started', value: startText, labelColor: GREEN_DARK_FG },
    { label: 'turns', value: turnText, labelColor: GREEN_DARK_FG },
  ];

  const labelWidth = rows.reduce((max, row) => Math.max(max, row.label.length), 0);

  const naturalContentWidth = rows.reduce(
    (max, row) => Math.max(max, labelWidth + SEPARATOR_WIDTH + row.value.length),
    0,
  );

  const { inner, contentWidth } = computePanelWidths({
    title: 'SESSION',
    naturalContentWidth,
    maxInner,
    minInner: 22,
  });

  return framePanelBody({
    title: 'SESSION',
    bodyLines: rows.map((entry) =>
      renderRow(entry.label, entry.labelColor, labelWidth, contentWidth, (vw) =>
        truncateToWidth(entry.value, vw, '…', true),
      ),
    ),
    inner,
    contentWidth,
  });
}
