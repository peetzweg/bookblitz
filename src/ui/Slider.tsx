import { useRef, useState } from "react";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}

/**
 * Apple Music-style slider: no thumb, the track thickens while held, and dragging is relative
 * to where you grabbed (a tap doesn't jump the value).
 */
export function Slider({ value, min, max, step = 1, label, onChange, onCommit }: SliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; value: number; last: number } | null>(null);
  const [active, setActive] = useState(false);
  const range = Math.max(max - min, 1);
  const fraction = Math.min(1, Math.max(0, (value - min) / range));

  const snap = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));

  return (
    <div
      ref={track}
      className={`slider ${active ? "active" : ""}`}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(e) => {
        const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? step : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : 0;
        if (!delta) return;
        e.preventDefault();
        e.stopPropagation();
        const next = snap(value + delta);
        onChange(next);
        onCommit?.(next);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, value, last: value };
        setActive(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        const width = track.current?.clientWidth;
        if (!d || !width) return;
        const next = snap(d.value + ((e.clientX - d.x) / width) * range);
        if (next !== d.last) {
          d.last = next;
          onChange(next);
        }
      }}
      onPointerUp={() => {
        if (drag.current) onCommit?.(drag.current.last);
        drag.current = null;
        setActive(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setActive(false);
      }}
    >
      <div className="slider-track">
        <div className="slider-fill" style={{ transform: `scaleX(${fraction})` }} />
      </div>
    </div>
  );
}
