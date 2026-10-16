import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import type { TargetGeometry } from '../../state/selectors';
import { hoverBus } from '../../state/hoverBus';
import { count } from '../../ui/format';

interface Props {
  target: string;
  geometry: TargetGeometry;
  color: string;
}

const AXIS = '#83968c';
const GRID = 'rgba(28,25,23,0.08)';

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return `rgba(37,99,235,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

/**
 * Profil altimétrique interactif (uPlot, rendu canvas).
 * Survol → distance/altitude + point sur la carte ; survol de la carte → curseur et bande du segment.
 */
export function ElevationProfile({ target, geometry, color }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const band = useRef<[number, number] | null>(null);
  const fromMap = useRef(false);
  const geomRef = useRef(geometry);
  geomRef.current = geometry;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const xs = Float64Array.from(geometry.cum, (d) => d / 1000);
    const ys = geometry.points.map((p) => p.ele);
    const hasEle = ys.some((y) => y !== null);
    const opts: uPlot.Options = {
      width: Math.max(200, el.clientWidth),
      height: Math.max(80, el.clientHeight),
      padding: [8, 12, 0, 0],
      scales: {
        x: { time: false },
        y: {
          range: (_u, min, max) => {
            if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1000];
            return [Math.max(0, Math.floor((min - 40) / 100) * 100), Math.ceil((max + 40) / 100) * 100];
          },
        },
      },
      axes: [
        {
          stroke: AXIS,
          grid: { show: false },
          ticks: { show: false },
          values: (_u, vals) => vals.map((v) => `${count(v)} km`),
          font: '9px Arial, sans-serif',
        },
        {
          stroke: AXIS,
          grid: { stroke: GRID, width: 1, dash: [4, 5] },
          ticks: { show: false },
          size: 58,
          values: (_u, vals) => vals.map((v) => `${count(v)} m`),
          font: '9px Arial, sans-serif',
        },
      ],
      series: [
        {},
        {
          label: 'Altitude',
          stroke: color,
          width: 1.5,
          points: { show: false },
          spanGaps: false,
        },
      ],
      legend: { show: false },
      cursor: {
        drag: { x: false, y: false, setScale: false },
        points: { size: 9, width: 2, stroke: '#ffffff', fill: color },
        y: false,
      },
      hooks: {
        setCursor: [
          (u) => {
            const idx = u.cursor.idx;
            const t = tip.current;
            if (idx === null || idx === undefined || u.cursor.left === undefined || u.cursor.left < 0) {
              if (t) t.style.display = 'none';
              if (!fromMap.current) hoverBus.emit({ source: 'profile', target, index: null });
              return;
            }
            const g = geomRef.current;
            const p = g.points[idx];
            if (t && p) {
              t.style.display = 'block';
              t.textContent = `${(g.cum[idx] / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km · ${
                p.ele === null ? 'altitude inconnue' : `${count(Math.round(p.ele))} m`
              }`;
              const left = Math.min(u.cursor.left + u.over.offsetLeft + 10, u.width - t.offsetWidth - 4);
              t.style.left = `${Math.max(0, left)}px`;
            }
            if (!fromMap.current) hoverBus.emit({ source: 'profile', target, index: idx, band: null });
          },
        ],
        draw: [
          (u) => {
            const ctx = u.ctx;
            const g = geomRef.current;
            const top = u.bbox.top;
            const h = u.bbox.height;
            ctx.save();
            if (band.current) {
              const x0 = u.valToPos(band.current[0] / 1000, 'x', true);
              const x1 = u.valToPos(band.current[1] / 1000, 'x', true);
              ctx.fillStyle = hexToRgba(color, 0.12);
              ctx.fillRect(Math.min(x0, x1), top, Math.abs(x1 - x0), h);
            }
            if (g.stageMarks?.length) {
              ctx.strokeStyle = 'rgba(28,25,23,0.45)';
              ctx.setLineDash([4, 4]);
              ctx.lineWidth = 1;
              ctx.fillStyle = '#1c1917';
              ctx.font = `${11 * devicePixelRatio}px system-ui, sans-serif`;
              for (const m of g.stageMarks) {
                const x = u.valToPos(m.distance / 1000, 'x', true);
                ctx.beginPath();
                ctx.moveTo(x, top);
                ctx.lineTo(x, top + h);
                ctx.stroke();
                ctx.fillText(m.label, x + 4 * devicePixelRatio, top + 12 * devicePixelRatio);
              }
            }
            ctx.restore();
          },
        ],
      },
    };
    const u = new uPlot(opts, [xs as unknown as number[], ys as (number | null)[]], el);
    plot.current = u;
    if (!hasEle) el.classList.add('no-ele');
    else el.classList.remove('no-ele');
    const obs = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) u.setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    obs.observe(el);
    const unsub = hoverBus.subscribe((e) => {
      if (e.source !== 'map' || e.target !== target) return;
      fromMap.current = true;
      const prevBand = band.current;
      band.current = e.band ?? null;
      if (e.index === null) {
        u.setCursor({ left: -10, top: -10 });
      } else {
        const g = geomRef.current;
        const x = u.valToPos(g.cum[e.index] / 1000, 'x');
        const ele = g.points[e.index]?.ele;
        u.setCursor({ left: x, top: ele === null || ele === undefined ? 0 : u.valToPos(ele, 'y') });
      }
      if (prevBand?.[0] !== band.current?.[0] || prevBand?.[1] !== band.current?.[1]) u.redraw(false);
      fromMap.current = false;
    });
    return () => {
      unsub();
      obs.disconnect();
      u.destroy();
      plot.current = null;
    };
  }, [geometry, color, target]);

  return (
    <div className="profile-chart" data-testid="elevation-profile">
      <div ref={wrap} className="profile-canvas" />
      <div ref={tip} className="profile-tip" data-testid="profile-tip" />
    </div>
  );
}
