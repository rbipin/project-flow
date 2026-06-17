'use client';

import * as React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TweakOption = string | { value: string; label: string };

// ---------------------------------------------------------------------------
// useTweaks
// ---------------------------------------------------------------------------

export function useTweaks<T extends Record<string, unknown>>(
  defaults: T,
): [T, (keyOrEdits: keyof T | Partial<T>, val?: T[keyof T]) => void] {
  const [values, setValues] = React.useState<T>(defaults);

  const setTweak = React.useCallback(
    (keyOrEdits: keyof T | Partial<T>, val?: T[keyof T]) => {
      const edits: Partial<T> =
        typeof keyOrEdits === 'object' && keyOrEdits !== null
          ? (keyOrEdits as Partial<T>)
          : ({ [keyOrEdits]: val } as Partial<T>);
      setValues((prev) => ({ ...prev, ...edits }));
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
      window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
    },
    [],
  );

  return [values, setTweak];
}

// ---------------------------------------------------------------------------
// TweaksPanel
// ---------------------------------------------------------------------------

export interface TweaksPanelProps {
  title?: string;
  children?: React.ReactNode;
}

export function TweaksPanel({ title = 'Tweaks', children }: TweaksPanelProps) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef<HTMLDivElement>(null);
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  const onDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev: MouseEvent) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <div
      ref={dragRef}
      className="twk-panel"
      data-omelette-chrome=""
      style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}
    >
      <div className="twk-hd" onMouseDown={onDragStart}>
        <b>{title}</b>
        <button
          className="twk-x"
          aria-label="Close tweaks"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
      <div className="twk-body">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TweakSection
// ---------------------------------------------------------------------------

export interface TweakSectionProps {
  label: string;
  children?: React.ReactNode;
}

export function TweakSection({ label, children }: TweakSectionProps) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

// ---------------------------------------------------------------------------
// TweakRow
// ---------------------------------------------------------------------------

export interface TweakRowProps {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
  inline?: boolean;
}

export function TweakRow({ label, value, children, inline = false }: TweakRowProps) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TweakSlider
// ---------------------------------------------------------------------------

export interface TweakSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange,
}: TweakSliderProps) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input
        type="range"
        className="twk-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </TweakRow>
  );
}

// ---------------------------------------------------------------------------
// TweakToggle
// ---------------------------------------------------------------------------

export interface TweakToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function TweakToggle({ label, value, onChange }: TweakToggleProps) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl">
        <span>{label}</span>
      </div>
      <button
        type="button"
        className="twk-toggle"
        data-on={value ? '1' : '0'}
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange(!value)}
      >
        <i></i>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TweakSelect
// ---------------------------------------------------------------------------

export interface TweakSelectProps {
  label: string;
  value: string;
  options: TweakOption[];
  onChange: (value: string) => void;
}

export function TweakSelect({ label, value, options, onChange }: TweakSelectProps) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </TweakRow>
  );
}

// ---------------------------------------------------------------------------
// TweakRadio
// ---------------------------------------------------------------------------

export interface TweakRadioProps {
  label: string;
  value: string;
  options: TweakOption[];
  onChange: (value: string) => void;
}

export function TweakRadio({ label, value, options, onChange }: TweakRadioProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const valueRef = React.useRef(value);
  valueRef.current = value;

  const labelLen = (o: TweakOption) =>
    String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments =
    maxLen <= (({ 2: 16, 3: 10 } as Record<number, number>)[options.length] ?? 0);

  if (!fitsAsSegments) {
    const resolve = (s: string) => {
      const m = options.find(
        (o) => String(typeof o === 'object' ? o.value : o) === s,
      );
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return (
      <TweakSelect
        label={label}
        value={value}
        options={options}
        onChange={(s) => onChange(resolve(s))}
      />
    );
  }

  const opts = options.map((o) =>
    typeof o === 'object' ? o : { value: o, label: o },
  );
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX: number): string => {
    if (!trackRef.current) return opts[0].value;
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev: PointerEvent) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div
        ref={trackRef}
        role="radiogroup"
        onPointerDown={onPointerDown}
        className={dragging ? 'twk-seg dragging' : 'twk-seg'}
      >
        <div
          className="twk-seg-thumb"
          style={{
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`,
          }}
        />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

// ---------------------------------------------------------------------------
// TweakText
// ---------------------------------------------------------------------------

export interface TweakTextProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function TweakText({ label, value, placeholder, onChange }: TweakTextProps) {
  return (
    <TweakRow label={label}>
      <input
        className="twk-field"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </TweakRow>
  );
}

// ---------------------------------------------------------------------------
// TweakNumber
// ---------------------------------------------------------------------------

export interface TweakNumberProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: TweakNumberProps) {
  const clamp = (n: number): number => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };

  const startRef = React.useRef({ x: 0, val: 0 });

  const onScrubStart = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TweakColor helpers
// ---------------------------------------------------------------------------

function __twkIsLight(hex: string): boolean {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const __TwkCheck = ({ light }: { light: boolean }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path
      d="M3 7.2 5.8 10 11 4.2"
      fill="none"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke={light ? 'rgba(0,0,0,.78)' : '#fff'}
    />
  </svg>
);

// ---------------------------------------------------------------------------
// TweakColor
// ---------------------------------------------------------------------------

export type TweakColorValue = string | string[];

export interface TweakColorProps {
  label: string;
  value: TweakColorValue;
  options?: TweakColorValue[];
  onChange: (value: TweakColorValue) => void;
}

export function TweakColor({ label, value, options, onChange }: TweakColorProps) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl">
          <span>{label}</span>
        </div>
        <input
          type="color"
          className="twk-swatch"
          value={Array.isArray(value) ? value[0] : value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  const key = (o: TweakColorValue) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);

  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button
              key={i}
              type="button"
              className="twk-chip"
              role="radio"
              aria-checked={on}
              data-on={on ? '1' : '0'}
              aria-label={colors.join(', ')}
              title={colors.join(' · ')}
              style={{ background: hero }}
              onClick={() => onChange(o)}
            >
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => (
                    <i key={j} style={{ background: c }}></i>
                  ))}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

// ---------------------------------------------------------------------------
// TweakButton
// ---------------------------------------------------------------------------

export interface TweakButtonProps {
  label: string;
  onClick: () => void;
  secondary?: boolean;
}

export function TweakButton({ label, onClick, secondary = false }: TweakButtonProps) {
  return (
    <button
      type="button"
      className={secondary ? 'twk-btn secondary' : 'twk-btn'}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
