import { useEffect, useState } from "react";
import type { WheelSlice } from "@/lib/league-types";

const SLICE_FILLS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-6)",
];

const SIZE = 340;
const C = SIZE / 2;
const R = C - 8;

function point(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  // Round so server and browser render identical paths (avoids hydration mismatch).
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return [r2(C + radius * Math.sin(a)), r2(C - radius * Math.cos(a))] as const;
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Rotation (deg) that puts slice `index` under the top pointer. */
export function rotationFor(index: number, count: number, turns: number) {
  const slice = 360 / count;
  return turns * 360 - (index * slice + slice / 2);
}

export function Wheel({
  slices,
  targetId,
  spinning,
  onSpinEnd,
}: {
  slices: WheelSlice[];
  targetId: string | null;
  spinning: boolean;
  onSpinEnd?: () => void;
}) {
  const count = Math.max(slices.length, 1);
  const slice = 360 / count;
  const targetIndex = targetId ? slices.findIndex((s) => s.id === targetId) : -1;
  const [rotation, setRotation] = useState(() =>
    targetIndex >= 0 && !spinning ? rotationFor(targetIndex, count, 0) : 0,
  );

  useEffect(() => {
    if (spinning && targetIndex >= 0) {
      // Next frame so the transition runs from the current angle.
      const id = requestAnimationFrame(() => setRotation(rotationFor(targetIndex, count, 7)));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [spinning, targetIndex, count]);

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div
        aria-hidden
        className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[26px] border-x-transparent border-t-foreground drop-shadow"
      />
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
        role="img"
        aria-label={`Punishment wheel with ${slices.length} punishments`}
      >
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "50% 50%",
            transition: spinning ? "transform 5.5s cubic-bezier(0.12, 0.7, 0.08, 1)" : "none",
          }}
          onTransitionEnd={() => onSpinEnd?.()}
        >
          {slices.length === 0 && (
            <circle cx={C} cy={C} r={R} fill="var(--secondary)" stroke="var(--border)" strokeWidth={3} />
          )}
          {slices.map((s, i) => {
            const start = i * slice;
            const end = start + slice;
            const [x1, y1] = point(start, R);
            const [x2, y2] = point(end, R);
            const large = slice > 180 ? 1 : 0;
            const d =
              count === 1
                ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z`
                : `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
            const mid = start + slice / 2;
            return (
              <g key={s.id}>
                <path
                  d={d}
                  fill={SLICE_FILLS[i % SLICE_FILLS.length]}
                  stroke="var(--background)"
                  strokeWidth={3}
                />
                <text
                  transform={`rotate(${mid} ${C} ${C}) translate(${C} ${C - R + 18}) rotate(90)`}
                  fill="var(--primary-foreground)"
                  fontSize={count > 6 ? 11 : 13}
                  fontWeight={700}
                  dominantBaseline="middle"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {truncate(s.text, count > 6 ? 20 : 24)}
                </text>
              </g>
            );
          })}
        </g>
        <circle cx={C} cy={C} r={26} fill="var(--background)" stroke="var(--foreground)" strokeWidth={3} />
        <text
          x={C}
          y={C + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--foreground)"
          fontSize={14}
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
        >
          SPIN
        </text>
      </svg>
    </div>
  );
}
