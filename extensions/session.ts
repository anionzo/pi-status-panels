import { truncateToWidth } from '@mariozechner/pi-tui';
import { labelBright, labelDim } from './utils';
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

  avgTurnDuration: number;
  tokensPerSec: number;
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

function formatDuration(ms: number): string {
  if (ms <= 0) return '-';
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

export function buildSessionPanel(snapshot: SessionSnapshot, maxInner: number): BuiltPanel {
  const elapsedText = formatElapsed(snapshot.elapsed);
  const startText = formatStartTime(snapshot.startedAt);
  const turnText = `${snapshot.turnCount}`;

  const rows: SessionRow[] = [
    { label: 'elapsed', value: elapsedText, labelColor: labelBright() },
    { label: 'started', value: startText, labelColor: labelDim() },
    { label: 'turns', value: turnText, labelColor: labelDim() },
  ];

  if (snapshot.turnCount > 0 && snapshot.avgTurnDuration > 0) {
    rows.push({ label: 'avg turn', value: formatDuration(snapshot.avgTurnDuration), labelColor: labelDim() });
  }

  if (snapshot.tokensPerSec > 0) {
    rows.push({ label: 'speed', value: `${snapshot.tokensPerSec.toFixed(1)} tok/s`, labelColor: labelDim() });
  }

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
