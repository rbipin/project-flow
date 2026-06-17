'use client';

import type { NodeStats, Marker } from '@/lib/types';

interface RoadmapProps {
  stats: NodeStats;
  variant: 'track' | 'stations' | 'stepper';
  mini?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="rm-check" aria-hidden="true">
      <path
        d="M5 12.5l4.2 4.2L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function cls(m: Marker, selectedId?: string | null): string {
  return (
    ' is-' + m.state +
    (m.hasChildren ? ' is-parent' : '') +
    (selectedId && m.id === selectedId ? ' is-selected' : '')
  );
}

function subLabel(m: Marker): string {
  return m.hasChildren ? m.childCount + ' milestones' : m.done + '/' + m.total + ' tasks';
}

function RoadmapTrack({ stats, mini, selectedId, onSelect }: Omit<RoadmapProps, 'variant'>) {
  const fillPct = Math.max(0, Math.min(1, stats.pct)) * 100;
  return (
    <div className={'rm-track' + (mini ? ' is-mini' : '') + (onSelect ? ' is-clickable' : '')}>
      <div className="rm-track-rail">
        <div className="rm-track-fill" style={{ width: fillPct + '%' }} />
        {!mini && stats.total > 0 && (
          <div className="rm-head" style={{ left: fillPct + '%' }}>
            <div className="rm-head-flag">{stats.pctLabel}%</div>
            <div className="rm-head-dot" />
          </div>
        )}
        {stats.markers.map((m) =>
          onSelect ? (
            <button
              key={m.id}
              className={'rm-node' + cls(m, selectedId)}
              style={{ left: m.pos * 100 + '%' }}
              onClick={() => onSelect(m.id)}
              title={'View ' + m.label}
            >
              <span className="rm-node-dot">
                {m.state === 'complete' ? <CheckIcon /> : <span className="rm-node-core" />}
              </span>
              {!mini && (
                <span className="rm-node-label">
                  <span className="rm-node-name">{m.label}</span>
                  <span className="rm-node-sub">{subLabel(m)}</span>
                </span>
              )}
            </button>
          ) : (
            <div
              key={m.id}
              className={'rm-node' + cls(m, selectedId)}
              style={{ left: m.pos * 100 + '%' }}
            >
              <span className="rm-node-dot">
                {m.state === 'complete' ? <CheckIcon /> : <span className="rm-node-core" />}
              </span>
              {!mini && (
                <span className="rm-node-label">
                  <span className="rm-node-name">{m.label}</span>
                  <span className="rm-node-sub">{subLabel(m)}</span>
                </span>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function RoadmapStations({ stats, mini, selectedId, onSelect }: Omit<RoadmapProps, 'variant'>) {
  const fillPct = Math.max(0, Math.min(1, stats.pct)) * 100;
  return (
    <div className={'rm-stations' + (mini ? ' is-mini' : '') + (onSelect ? ' is-clickable' : '')}>
      <div className="rm-stations-rail">
        <div className="rm-stations-fill" style={{ width: fillPct + '%' }} />
        {stats.markers.map((m, i) =>
          onSelect ? (
            <button
              key={m.id}
              className={'rm-station' + cls(m, selectedId) + (i % 2 === 0 ? ' label-top' : ' label-bottom')}
              style={{ left: m.pos * 100 + '%' }}
              onClick={() => onSelect(m.id)}
              title={'View ' + m.label}
            >
              {!mini && i % 2 === 0 && (
                <span className="rm-station-label">
                  <b>{m.label}</b>
                  <em>{m.state === 'complete' ? 'complete' : subLabel(m)}</em>
                </span>
              )}
              <span className="rm-station-node">
                {m.state === 'complete' ? <CheckIcon /> : <span className="rm-station-core" />}
              </span>
              {!mini && i % 2 !== 0 && (
                <span className="rm-station-label">
                  <b>{m.label}</b>
                  <em>{m.state === 'complete' ? 'complete' : subLabel(m)}</em>
                </span>
              )}
            </button>
          ) : (
            <div
              key={m.id}
              className={'rm-station' + cls(m, selectedId) + (i % 2 === 0 ? ' label-top' : ' label-bottom')}
              style={{ left: m.pos * 100 + '%' }}
            >
              {!mini && i % 2 === 0 && (
                <span className="rm-station-label">
                  <b>{m.label}</b>
                  <em>{m.state === 'complete' ? 'complete' : subLabel(m)}</em>
                </span>
              )}
              <span className="rm-station-node">
                {m.state === 'complete' ? <CheckIcon /> : <span className="rm-station-core" />}
              </span>
              {!mini && i % 2 !== 0 && (
                <span className="rm-station-label">
                  <b>{m.label}</b>
                  <em>{m.state === 'complete' ? 'complete' : subLabel(m)}</em>
                </span>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function RoadmapStepper({ stats, mini, selectedId, onSelect }: Omit<RoadmapProps, 'variant'>) {
  return (
    <div className={'rm-stepper' + (mini ? ' is-mini' : '') + (onSelect ? ' is-clickable' : '')}>
      {stats.markers.map((m, i) =>
        onSelect ? (
          <button
            key={m.id}
            className={'rm-step' + cls(m, selectedId)}
            onClick={() => onSelect(m.id)}
            title={'View ' + m.label}
          >
            <span className="rm-step-badge">
              {m.state === 'complete' ? <CheckIcon /> : i + 1}
            </span>
            {!mini && (
              <span className="rm-step-text">
                <b>{m.label}</b>
                <em>
                  {m.state === 'complete'
                    ? 'Done'
                    : m.hasChildren
                    ? m.childCount + ' milestones'
                    : m.state === 'progress'
                    ? m.done + '/' + m.total + ' tasks'
                    : 'Not started'}
                </em>
              </span>
            )}
          </button>
        ) : (
          <div key={m.id} className={'rm-step' + cls(m, selectedId)}>
            <span className="rm-step-badge">
              {m.state === 'complete' ? <CheckIcon /> : i + 1}
            </span>
            {!mini && (
              <span className="rm-step-text">
                <b>{m.label}</b>
                <em>
                  {m.state === 'complete'
                    ? 'Done'
                    : m.hasChildren
                    ? m.childCount + ' milestones'
                    : m.state === 'progress'
                    ? m.done + '/' + m.total + ' tasks'
                    : 'Not started'}
                </em>
              </span>
            )}
          </div>
        )
      )}
    </div>
  );
}

export function Roadmap(props: RoadmapProps) {
  if (props.variant === 'stations') return <RoadmapStations {...props} />;
  if (props.variant === 'stepper') return <RoadmapStepper {...props} />;
  return <RoadmapTrack {...props} />;
}
