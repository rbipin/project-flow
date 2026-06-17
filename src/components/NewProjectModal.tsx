'use client';

import { useState, useEffect, useRef } from 'react';
import { flattenNodes, uid, REL } from '@/lib/data';
import type { ProjectNode, RelationType } from '@/lib/types';
import { Modal } from './Modal';

type ChildSpec = ProjectNode | { __attach: string };

type MilestoneRow = {
  key: string;
  kind: 'new' | 'attach';
  name?: string;
  id?: string;
};

type RelationDraft = {
  to: string;
  type: RelationType;
};

interface NewProjectModalProps {
  projects: ProjectNode[];
  onClose: () => void;
  onCreate: (spec: Omit<ProjectNode, 'children'> & { children: ChildSpec[] }) => void;
}

const DEFAULT_MILESTONES = ['Kickoff', 'Build', 'Review', 'Launch'];

let _rk = 0;
const rowKey = () => 'r' + _rk++;

export function NewProjectModal({ projects, onClose, onCreate }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [blurb, setBlurb] = useState('');
  const [due, setDue] = useState('');
  const [rows, setRows] = useState<MilestoneRow[]>(() =>
    DEFAULT_MILESTONES.map((m) => ({ key: rowKey(), kind: 'new', name: m }))
  );
  const [relations, setRelations] = useState<RelationDraft[]>([]);
  const [relType, setRelType] = useState<RelationType>('depends');
  const [relTarget, setRelTarget] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nameRef.current) nameRef.current.focus();
  }, []);

  const allNodes = flattenNodes(projects || []);
  const topProjects = (projects || []).map((p) => ({ id: p.id, name: p.name }));
  const attachedIds = rows.filter((r) => r.kind === 'attach').map((r) => r.id as string);
  const attachOptions = topProjects.filter((p) => !attachedIds.includes(p.id));

  const setRow = (key: string, patch: Partial<MilestoneRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addNew = () => setRows((rs) => [...rs, { key: rowKey(), kind: 'new', name: '' }]);
  const addAttach = () => setRows((rs) => [...rs, { key: rowKey(), kind: 'attach', id: '' }]);
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  const addRelation = () => {
    if (!relTarget) return;
    setRelations((rl) => [...rl, { to: relTarget, type: relType }]);
    setRelTarget('');
    setRelType('depends');
  };
  const removeRelation = (i: number) =>
    setRelations((rl) => rl.filter((_, idx) => idx !== i));

  const nodeName = (id: string) => {
    const n = allNodes.find((o) => o.id === id);
    return n ? n.breadcrumb.join(' › ') : '—';
  };

  const validRows = rows.filter((r) => (r.kind === 'new' ? r.name?.trim() : r.id));
  const canCreate = name.trim() && validRows.length >= 1;

  const submit = () => {
    if (!canCreate) return;
    const children: ChildSpec[] = validRows.map((r) =>
      r.kind === 'attach'
        ? ({ __attach: r.id as string } as { __attach: string })
        : ({
            id: uid(),
            name: (r.name as string).trim(),
            blurb: '',
            tasks: [],
            children: [],
            relations: [],
          } as ProjectNode)
    );
    onCreate({
      id: uid(),
      name: name.trim(),
      blurb: blurb.trim() || 'No description yet.',
      created: '2026-05-29',
      due: due || '',
      tasks: [],
      relations: relations.slice(),
      children,
    });
  };

  return (
    <Modal
      title="New project"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!canCreate} onClick={submit}>
            Create project
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Project name</span>
        <input
          ref={nameRef}
          className="input"
          value={name}
          placeholder="e.g. Website Relaunch"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Short description</span>
        <input
          className="input"
          value={blurb}
          placeholder="One line about the goal"
          onChange={(e) => setBlurb(e.target.value)}
        />
      </label>
      <label className="field field-half">
        <span className="field-label">Target date</span>
        <input
          className="input"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </label>
      <div className="field">
        <span className="field-label">
          Milestones{' '}
          <em className="hint">— add new ones, or attach an existing project</em>
        </span>
        <div className="ms-editor">
          {rows.map((r, i) => (
            <div className="ms-row" key={r.key}>
              <span className="ms-idx">{i + 1}</span>
              {r.kind === 'attach' ? (
                <select
                  className="input"
                  value={r.id ?? ''}
                  onChange={(e) => setRow(r.key, { id: e.target.value })}
                >
                  <option value="">Choose a project to attach…</option>
                  {topProjects.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={attachedIds.includes(p.id) && p.id !== r.id}
                    >
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  value={r.name ?? ''}
                  placeholder="Milestone name"
                  onChange={(e) => setRow(r.key, { name: e.target.value })}
                />
              )}
              {r.kind === 'attach' && <span className="ms-tag">attached</span>}
              <button
                className="icon-btn sm"
                onClick={() => removeRow(r.key)}
                aria-label="Remove"
                disabled={rows.length <= 1}
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
          <div className="ms-addrow">
            <button className="btn ghost sm" onClick={addNew}>
              + Add milestone
            </button>
            {attachOptions.length > 0 && (
              <button className="btn ghost sm" onClick={addAttach}>
                ↳ Attach a project
              </button>
            )}
          </div>
        </div>
      </div>
      {allNodes.length > 0 && (
        <div className="field">
          <span className="field-label">
            Relationships{' '}
            <em className="hint">— link this to other projects (optional)</em>
          </span>
          {relations.length > 0 && (
            <ul className="draft-tasks">
              {relations.map((rl, i) => (
                <li key={i}>
                  <span>
                    <b style={{ fontWeight: 700 }}>{REL[rl.type].label}</b> ·{' '}
                    {nodeName(rl.to)}
                  </span>
                  <button className="x" onClick={() => removeRelation(i)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="rel-add" style={{ marginTop: 9 }}>
            <select
              className="input"
              value={relType}
              onChange={(e) => setRelType(e.target.value as RelationType)}
            >
              <option value="depends">Depends on</option>
              <option value="blocks">Blocks</option>
              <option value="related">Related to</option>
            </select>
            <select
              className="input"
              value={relTarget}
              onChange={(e) => setRelTarget(e.target.value)}
            >
              <option value="">Choose a project or milestone…</option>
              {allNodes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.breadcrumb.join('  ›  ')}
                </option>
              ))}
            </select>
            <button
              className="btn ghost sm"
              onClick={addRelation}
              disabled={!relTarget}
            >
              Add link
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default NewProjectModal;
