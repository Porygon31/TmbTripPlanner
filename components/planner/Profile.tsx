"use client";
import { useMemo } from "react";
import { km, meters, profile, nearestIndex } from "@/lib/tmb/geo";
import type { Route, RoutePoint, ElevationPoint } from "@/lib/tmb/types";
export default function Profile({
  route,
  hover,
  onHover,
  data,
}: {
  route: Route;
  hover: RoutePoint | null;
  onHover: (p: RoutePoint) => void;
  data?: ElevationPoint[];
}) {
  const points = useMemo(
    () => data ?? profile(route.segments),
    [data, route.segments],
  );
  const known = points.filter((p) => p.ele !== undefined);
  if (!known.length)
    return (
      <div className="profile-empty">
        <span className="eyebrow">PROFIL ALTIMÉTRIQUE</span>
        <h2>
          {points.length
            ? "Altitudes non renseignées"
            : "Chaque montée a son horizon."}
        </h2>
        <p>
          {points.length
            ? "Cette trace ne contient pas d’altitudes. Enrichissez-la dans Mon parcours."
            : "Personnalisez le classique ou créez votre parcours pour découvrir son relief."}
        </p>
      </div>
    );
  const maxD = points.at(-1)?.distance || 1,
    min = Math.floor(Math.min(...known.map((p) => p.ele!)) / 500) * 500,
    max = Math.max(min + 500, Math.ceil(Math.max(...known.map((p) => p.ele!)) / 500) * 500);
  const x = (d: number) => 45 + (d / maxD) * 950,
    y = (e: number) => 125 - ((e - min) / (max - min)) * 100;
  const stride = Math.max(1, Math.floor(points.length / 1200));
  const simplified = points.filter(
    (p, i) => i % stride === 0 || p.breakBefore || p.ele === undefined || points[i - 1]?.ele === undefined || i === points.length - 1,
  );
  const path = simplified
    .map((p,i) => {
      if (p.ele === undefined) {
        return "";
      }
      const op = i>0 && simplified[i-1].ele!==undefined && !p.breakBefore ? "L" : "M";
      return `${op}${x(p.distance).toFixed(2)} ${y(p.ele).toFixed(2)}`;
    })
    .join(" ");
  const selected = hover ? points[nearestIndex(points, hover).index] : null;
  const inspect=(e:React.PointerEvent<SVGSVGElement>)=>{const box=e.currentTarget.getBoundingClientRect();const d=Math.max(0,Math.min(1,((e.clientX-box.left)/box.width*1020-45)/950))*maxD;let low=0,high=points.length-1;while(low<high){const mid=Math.floor((low+high)/2);if(points[mid].distance<d)low=mid+1;else high=mid;}onHover(points[low]);};
  return (
    <div className="elevation-chart">
      <div className="profile-heading">
        <span className="eyebrow">PROFIL ALTIMÉTRIQUE</span>
        <span>
          {selected
            ? `${km(selected.distance)} km · ${selected.ele === undefined ? "—" : meters(selected.ele) + " m"}`
            : "Survolez ou touchez pour explorer"}
        </span>
      </div>
      <svg
        viewBox="0 0 1020 155"
        preserveAspectRatio="none"
        role="img"
        aria-label="Profil d’altitude en fonction de la distance"
        onPointerDown={inspect}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const d =
            Math.max(
              0,
              Math.min(
                1,
                (((e.clientX - box.left) / box.width) * 1020 - 45) / 950,
              ),
            ) * maxD;
          let low = 0,
            high = points.length - 1;
          while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (points[mid].distance < d) low = mid + 1;
            else high = mid;
          }
          onHover(points[low]);
        }}
      >
        {[min, (min + max) / 2, max].map((v) => (
          <g key={v}>
            <line
              x1="45"
              x2="995"
              y1={y(v)}
              y2={y(v)}
              stroke="#e6ece5"
              strokeDasharray="3 4"
            />
            <text x="0" y={y(v) + 4}>
              {meters(v)} m
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} x={x(maxD * f)} y="149" textAnchor="middle">
            {km(maxD * f)} km
          </text>
        ))}
        <path d={path} fill="none" stroke="#d9714c" strokeWidth="2.1" />
        {selected && (
          <g>
            <line
              x1={x(selected.distance)}
              x2={x(selected.distance)}
              y1="20"
              y2="130"
              stroke="#274e4d"
              strokeDasharray="3 3"
            />
            {selected.ele !== undefined && (
              <circle
                cx={x(selected.distance)}
                cy={y(selected.ele)}
                r="4"
                fill="#244c4d"
                stroke="white"
                strokeWidth="2"
              />
            )}
          </g>
        )}
      </svg>
      <div className="mobile-axis-labels"><span>0 km</span><span>{meters(min)}–{meters(max)} m</span><span>{km(maxD)} km</span></div>
      <div className="profile-foot">
        Altitude issue des données disponibles · dénivelé filtré, seuil 5 m ·
        les ruptures ne sont pas reliées
      </div>
    </div>
  );
}
