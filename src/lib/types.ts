export interface Project {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Phase {
  id: string;
  projectId: string;
  title: string;
  summary?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Deliverable {
  id: string;
  phaseId: string;
  title: string;
  summary?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  deliverableId: string;
  title: string;
  content?: string;
  status: 'todo' | 'in_progress' | 'done';
  createdAt: number;
  updatedAt: number;
}

// Union type for the UI tree selection
export type TreeNodeType = 'project' | 'phase' | 'deliverable' | 'task';

export interface SelectedNode {
  type: TreeNodeType;
  id: string;
}
