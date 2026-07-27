export interface Project {
  id: string;
  title: string;
  createdAt: number; // store as milliseconds / timestamp for simple serialization
  updatedAt: number;
}

export interface ProjectNode {
  id: string;
  parentId: string | null;
  label: string;
  createdAt: number;
}

export interface ProgressLog {
  id: string;
  nodeId: string;
  rawMemo: string;
  conclusion: string;
  struggle: string;
  discussion: string;
  createdAt: number;
}
