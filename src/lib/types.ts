export type Task = {
  id: string;
  title: string;
  done: boolean;
};

export type RelationType = 'depends' | 'blocks' | 'related';

export type Relation = {
  to: string;
  type: RelationType;
};

export type ProjectNode = {
  id: string;
  name: string;
  blurb: string;
  tasks: Task[];
  children: ProjectNode[];
  relations: Relation[];
  created?: string;
  due?: string;
};

export type RelMeta = {
  label: string;
  rev: string;
  tone: 'warn' | 'danger' | 'neutral';
};

export type Marker = {
  id: string;
  label: string;
  pos: number;
  pct: number;
  done: number;
  total: number;
  complete: boolean;
  started: boolean;
  hasChildren: boolean;
  childCount: number;
  state: 'complete' | 'progress' | 'todo';
};

export type NodeStats = {
  isLeaf: boolean;
  total: number;
  done: number;
  pct: number;
  pctLabel: number;
  markers: Marker[];
  reachedCount: number;
  milestoneCount: number;
  currentIndex: number;
  currentLabel: string;
  complete: boolean;
  started: boolean;
};

export type TweakValues = {
  roadmapStyle: 'track' | 'stations' | 'stepper';
  accent: string;
  density: 'compact' | 'regular' | 'comfy';
  showRing: boolean;
};

export type ResolvedRelation = {
  dir: 'in' | 'out';
  type: RelationType;
  label: string;
  node: ProjectNode;
  path: string[];
  stats: NodeStats;
};

export type GatheredRelations = {
  outgoing: ResolvedRelation[];
  incoming: ResolvedRelation[];
  count: number;
};

export type FlatNode = {
  id: string;
  name: string;
  breadcrumb: string[];
  depth: number;
};

export type SubProject = {
  node: ProjectNode;
  path: string[];
  parent: string;
};
