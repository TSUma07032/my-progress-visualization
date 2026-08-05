export interface Project {
  id: string;
  name: string;
  created_at: string;
}

export type WbsNodeStatus = 'not_started' | 'in_progress' | 'completed';

export interface WbsNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  node_level: number;
  title: string;
  status: WbsNodeStatus;
  order_rank: string;
  created_at: string;
}

export interface WbsNodeWithNumber extends WbsNode {
  wbs_number: string;
  children?: WbsNodeWithNumber[];
}

export interface Todo {
  id: string;
  node_id: string;
  content: string | null;
  is_completed: boolean;
  created_at: string;
}
