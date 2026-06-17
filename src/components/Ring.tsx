'use client';

interface RingProps {
  pct: number;
  size?: number;
  stroke?: number;
}

export function Ring({ pct, size = 56, stroke = 5 }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  return (
    <svg width={size} height={size} className="ring" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rail)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)' }}
      />
      <text x="50%" y="50%" className="ring-text" dominantBaseline="central" textAnchor="middle">
        {Math.round(pct * 100)}
      </text>
    </svg>
  );
}
