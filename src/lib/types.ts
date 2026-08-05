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
  situation: string;
  task: string;
  action: string;
  result: string;
  question?: string;
  nextTodo?: string;
  createdAt: number;
  talked?: boolean; // 話済み or まだ話していない
}
