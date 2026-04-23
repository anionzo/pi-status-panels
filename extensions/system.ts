import { cpus, totalmem, freemem } from 'node:os';
import { truncateToWidth } from '@mariozechner/pi-tui';
import { labelBright, labelDim, tint, usageColor, visibleWidth, clamp } from './utils';
import {
  computePanelWidths,
  framePanelBody,
  renderRow,
  SEPARATOR_WIDTH,
  type BuiltPanel,
} from './panel';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

export type SystemSnapshot = {
  cpuPercent: number;
  ramUsedGB: number;
  ramTotalGB: number;
  ramPercent: number;
  gpuName: string | null;
  gpuPercent: number | null;
  gpuMemUsedMB: number | null;
  gpuMemTotalMB: number | null;
};

// ── CPU measurement (delta-based) ──────────────────────────────────────
let prevCpuIdle = 0;
let prevCpuTotal = 0;

function measureCpuPercent(): number {
  const cpuList = cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpuList) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }

  const deltaIdle = idle - prevCpuIdle;
  const deltaTotal = total - prevCpuTotal;

  prevCpuIdle = idle;
  prevCpuTotal = total;

  if (deltaTotal === 0) return 0;
  return clamp(((deltaTotal - deltaIdle) / deltaTotal) * 100, 0, 100);
}

// ── GPU (nvidia-smi) ───────────────────────────────────────────────────
let gpuAvailable: boolean | null = null; // null = not checked yet

async function readGpuStats(
  pi: ExtensionAPI,
): Promise<{ name: string; percent: number; memUsed: number; memTotal: number } | null> {
  // Skip if we already know GPU is not available
  if (gpuAvailable === false) return null;

  try {
    const result = await pi.exec(
      'nvidia-smi',
      ['--query-gpu=name,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'],
      { timeout: 2000 },
    );

    if (result.code !== 0) {
      gpuAvailable = false;
      return null;
    }

    gpuAvailable = true;
    const line = result.stdout.trim().split('\n')[0];
    if (!line) return null;

    const parts = line.split(',').map((s) => s.trim());
    if (parts.length < 4) return null;

    return {
      name: parts[0]!,
      percent: Number.parseFloat(parts[1]!) || 0,
      memUsed: Number.parseFloat(parts[2]!) || 0,
      memTotal: Number.parseFloat(parts[3]!) || 0,
    };
  } catch {
    gpuAvailable = false;
    return null;
  }
}

export async function readSystemStats(pi: ExtensionAPI): Promise<SystemSnapshot> {
  const cpuPercent = measureCpuPercent();

  const totalBytes = totalmem();
  const freeBytes = freemem();
  const usedBytes = totalBytes - freeBytes;
  const ramTotalGB = totalBytes / (1024 ** 3);
  const ramUsedGB = usedBytes / (1024 ** 3);
  const ramPercent = (usedBytes / totalBytes) * 100;

  const gpu = await readGpuStats(pi);

  return {
    cpuPercent,
    ramUsedGB,
    ramTotalGB,
    ramPercent,
    gpuName: gpu?.name ?? null,
    gpuPercent: gpu?.percent ?? null,
    gpuMemUsedMB: gpu?.memUsed ?? null,
    gpuMemTotalMB: gpu?.memTotal ?? null,
  };
}

// ── Mini usage bar ─────────────────────────────────────────────────────
function renderMiniBar(percent: number, valueWidth: number): string {
  const safePercent = clamp(percent, 0, 100);
  const pctText = `${Math.round(safePercent)}%`;

  const barWidth = Math.max(4, Math.min(12, valueWidth - pctText.length - 1));
  const filled = Math.round((safePercent / 100) * barWidth);

  const color = usageColor(safePercent);
  const fill = tint('█'.repeat(Math.max(0, filled)), color);
  const empty = '░'.repeat(Math.max(0, barWidth - filled));

  const composed = `${fill}${empty} ${tint(pctText, color)}`;
  const deficit = valueWidth - visibleWidth(composed);
  return deficit > 0 ? `${composed}${' '.repeat(deficit)}` : composed;
}

// ── Panel builder ──────────────────────────────────────────────────────
type SystemRow = {
  label: string;
  labelColor: string;
  renderValue: (vw: number) => string;
  measure: number;
};

export function buildSystemPanel(snapshot: SystemSnapshot, maxInner: number): BuiltPanel {
  const rows: SystemRow[] = [
    {
      label: 'cpu',
      labelColor: labelBright(),
      measure: 17, // bar + pct
      renderValue: (vw) => renderMiniBar(snapshot.cpuPercent, vw),
    },
    {
      label: 'ram',
      labelColor: labelDim(),
      measure: 17,
      renderValue: (vw) => {
        const text = `${snapshot.ramUsedGB.toFixed(1)}/${snapshot.ramTotalGB.toFixed(1)} GB`;
        const bar = renderMiniBar(snapshot.ramPercent, Math.max(4, vw - text.length - 1));
        const full = `${bar} ${text}`;
        return truncateToWidth(full, vw, '…', true);
      },
    },
  ];

  if (snapshot.gpuPercent != null) {
    const gpuLabel = snapshot.gpuName
      ? `gpu`
      : 'gpu';

    rows.push({
      label: gpuLabel,
      labelColor: labelDim(),
      measure: 17,
      renderValue: (vw) => renderMiniBar(snapshot.gpuPercent!, vw),
    });

    if (snapshot.gpuMemUsedMB != null && snapshot.gpuMemTotalMB != null) {
      const memText = snapshot.gpuMemTotalMB >= 1024
        ? `${(snapshot.gpuMemUsedMB / 1024).toFixed(1)}/${(snapshot.gpuMemTotalMB / 1024).toFixed(1)} GB`
        : `${Math.round(snapshot.gpuMemUsedMB)}/${Math.round(snapshot.gpuMemTotalMB)} MB`;
      rows.push({
        label: 'vram',
        labelColor: labelDim(),
        measure: memText.length,
        renderValue: (vw) => truncateToWidth(memText, vw, '…', true),
      });
    }
  }

  const labelWidth = rows.reduce((max, r) => Math.max(max, r.label.length), 0);

  const naturalContentWidth = rows.reduce(
    (max, r) => Math.max(max, labelWidth + SEPARATOR_WIDTH + r.measure),
    0,
  );

  const { inner, contentWidth } = computePanelWidths({
    title: 'SYSTEM',
    naturalContentWidth,
    maxInner,
    minInner: 22,
  });

  return framePanelBody({
    title: 'SYSTEM',
    bodyLines: rows.map((entry) =>
      renderRow(entry.label, entry.labelColor, labelWidth, contentWidth, entry.renderValue),
    ),
    inner,
    contentWidth,
  });
}
