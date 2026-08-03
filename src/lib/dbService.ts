import { db, hasFirebaseConfig } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { Project, ProjectNode, ProgressLog } from "./types";

// Key for storage mode preference
const STORAGE_PREF_KEY = "map_thinking_log_storage_pref";

export function getStoragePreference(): "firebase" | "mock" {
  if (typeof window === "undefined") return "mock";
  const pref = localStorage.getItem(STORAGE_PREF_KEY);
  if (pref === "firebase" && hasFirebaseConfig) {
    return "firebase";
  }
  return "mock";
}

export function setStoragePreference(pref: "firebase" | "mock") {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_PREF_KEY, pref);
}

// Generate unique ID helper
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Default Seed Data
const DEFAULT_PROJECTS: Project[] = [
  {
    id: "proj-agent-dev",
    title: "自律型AIエージェント開発プロジェクト",
    createdAt: Date.now() - 3600000 * 48,
    updatedAt: Date.now(),
  },
];

const DEFAULT_NODES: Record<string, ProjectNode[]> = {
  "proj-agent-dev": [
    {
      id: "node-root",
      parentId: null,
      label: "目的：自律的なタスク解決エージェントの構築",
      createdAt: Date.now() - 3600000 * 48,
    },
    {
      id: "node-llm",
      parentId: "node-root",
      label: "LLM API連携と機能設計",
      createdAt: Date.now() - 3600000 * 47,
    },
    {
      id: "node-prompt",
      parentId: "node-llm",
      label: "プロンプトエンジニアリング & JSON構造化",
      createdAt: Date.now() - 3600000 * 46,
    },
    {
      id: "node-db",
      parentId: "node-root",
      label: "データ蓄積（Firestore・LocalStorage）",
      createdAt: Date.now() - 3600000 * 45,
    },
    {
      id: "node-ui",
      parentId: "node-root",
      label: "React Flowによる可視化 UI/UX",
      createdAt: Date.now() - 3600000 * 44,
    },
  ],
};

const DEFAULT_LOGS: Record<string, ProgressLog[]> = {
  "proj-agent-dev": [
    {
      id: "log-1",
      nodeId: "node-prompt",
      rawMemo: `### 今週の作業メモ
Gemini 2.5-flashを用いてJSONの構造化出力を試行した。
スキーマを指定することでかなり安定して出力が得られるようになったが、たまに想定外のハルシネーションが発生して関係ない新規ノードを提案してくる問題に直面した。`,
      situation: "Gemini 2.5-flashを用いてJSONの構造化出力を試行した。",
      task: "JSONの構造化と安定出力",
      action: "スキーマを指定することでかなり安定して出力が得られるようになったが、たまに想定外のハルシネーションが発生して関係ない新規ノードを提案してくる問題に直面した。極稀に発生するハルシネーションと、出力スキーマから逸脱したキーが返された場合の安全なフォールバック設計に苦戦した。",
      result: "GeminiのStructured Outputsを利用したJSON出力の構造化と安定化に成功した。",
      question: "例外的なノード出力があった際、既存ツリーにどうマッピングさせるか、または「未分類」に綺麗に振り分けるルール作りについて、相談したい。",
      nextTodo: "さらなるテストケースの追加",
      createdAt: Date.now() - 3600000 * 24,
      talked: false,
    },
  ],
};

// Initialize Mock data in LocalStorage if empty
function initMockData() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem("proj_list")) {
    localStorage.setItem("proj_list", JSON.stringify(DEFAULT_PROJECTS));
  }
  DEFAULT_PROJECTS.forEach((p) => {
    if (!localStorage.getItem(`nodes_${p.id}`)) {
      localStorage.setItem(`nodes_${p.id}`, JSON.stringify(DEFAULT_NODES[p.id] || []));
    }
    if (!localStorage.getItem(`logs_${p.id}`)) {
      localStorage.setItem(`logs_${p.id}`, JSON.stringify(DEFAULT_LOGS[p.id] || []));
    }
  });
}

// Initialize on import
initMockData();

export const dbService = {
  // PROJECTS
  async getProjects(): Promise<Project[]> {
    const mode = getStoragePreference();
    if (mode === "firebase" && db) {
      try {
        const querySnapshot = await getDocs(collection(db, "projects"));
        const projects: Project[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          projects.push({
            id: docSnap.id,
            title: data.title || "",
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
            updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || Date.now()),
          });
        });
        // If empty in Firestore, seed with default
        if (projects.length === 0) {
          const defaultProj = DEFAULT_PROJECTS[0];
          await this.createProject(defaultProj.title, defaultProj.id);
          // Also seed nodes and logs
          for (const node of DEFAULT_NODES[defaultProj.id]) {
            await this.createNode(defaultProj.id, node.label, node.parentId, node.id);
          }
          for (const log of DEFAULT_LOGS[defaultProj.id]) {
            await this.createLog(defaultProj.id, log.nodeId, log.rawMemo, log.situation, log.task, log.action, log.result, log.question, log.nextTodo, log.id, log.createdAt, log.talked);
          }
          return [defaultProj];
        }
        return projects.sort((a, b) => b.createdAt - a.createdAt);
      } catch (err) {
        console.error("Firestore getProjects failed, falling back to Mock", err);
      }
    }

    // LocalStorage fallback
    const projs = localStorage.getItem("proj_list");
    return projs ? JSON.parse(projs) : [];
  },

  async createProject(title: string, customId?: string): Promise<Project> {
    const id = customId || generateId();
    const newProj: Project = {
      id,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mode = getStoragePreference();
    if (mode === "firebase" && db) {
      try {
        await setDoc(doc(db, "projects", id), {
          title,
          createdAt: new Date(newProj.createdAt),
          updatedAt: new Date(newProj.updatedAt),
        });
        return newProj;
      } catch (err) {
        console.error("Firestore createProject failed", err);
      }
    }

    // LocalStorage fallback
    const list = await this.getProjects();
    list.unshift(newProj);
    localStorage.setItem("proj_list", JSON.stringify(list));
    return newProj;
  },

  // NODES
  async getNodes(projectId: string): Promise<ProjectNode[]> {
    const mode = getStoragePreference();
    if (mode === "firebase" && db) {
      try {
        const querySnapshot = await getDocs(collection(db, "projects", projectId, "nodes"));
        const nodes: ProjectNode[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          nodes.push({
            id: docSnap.id,
            parentId: data.parentId || null,
            label: data.label || "",
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
          });
        });
        return nodes.sort((a, b) => a.createdAt - b.createdAt);
      } catch (err) {
        console.error("Firestore getNodes failed, falling back to Mock", err);
      }
    }

    // LocalStorage fallback
    const stored = localStorage.getItem(`nodes_${projectId}`);
    return stored ? JSON.parse(stored) : [];
  },

  async createNode(projectId: string, label: string, parentId: string | null, customId?: string): Promise<ProjectNode> {
    const id = customId || generateId();
    const newNode: ProjectNode = {
      id,
      parentId,
      label,
      createdAt: Date.now(),
    };

    const mode = getStoragePreference();
    if (mode === "firebase" && db) {
      try {
        await setDoc(doc(db, "projects", projectId, "nodes", id), {
          parentId,
          label,
          createdAt: new Date(newNode.createdAt),
        });
        return newNode;
      } catch (err) {
        console.error("Firestore createNode failed", err);
      }
    }

    // LocalStorage fallback
    const list = await this.getNodes(projectId);
    list.push(newNode);
    localStorage.setItem(`nodes_${projectId}`, JSON.stringify(list));
    return newNode;
  },

  async updateNode(projectId: string, nodeId: string, fields: Partial<Omit<ProjectNode, "id" | "createdAt">>): Promise<void> {
    const mode = getStoragePreference();
    if (mode === "firebase" && db) {
      try {
        const docRef = doc(db, "projects", projectId, "nodes", nodeId);
        await updateDoc(docRef, fields);
        return;
      } catch (err) {
        console.error("Firestore updateNode failed", err);
      }
    }

    // LocalStorage fallback
    const list = await this.getNodes(projectId);
    const index = list.findIndex((n) => n.id === nodeId);
    if (index !== -1) {
      list[index] = { ...list[index], ...fields };
      localStorage.setItem(`nodes_${projectId}`, JSON.stringify(list));
    }
  },

  async deleteNode(projectId: string, nodeId: string): Promise<void> {
    const mode = getStoragePreference();
    if (mode === "firebase" && db) {
      try {
        await deleteDoc(doc(db, "projects", projectId, "nodes", nodeId));
        return;
      } catch (err) {
        console.error("Firestore deleteNode failed", err);
      }
    }

    // LocalStorage fallback
    const list = await this.getNodes(projectId);
    const filtered = list.filter((n) => n.id !== nodeId);
    localStorage.setItem(`nodes_${projectId}`, JSON.stringify(filtered));
  },

  // LOGS
  async getLogs(projectId: string): Promise<ProgressLog[]> {
    const mode = getStoragePreference();
    if (mode === "firebase" && db) {
      try {
        const querySnapshot = await getDocs(collection(db, "projects", projectId, "logs"));
        const logs: ProgressLog[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          logs.push({
            id: docSnap.id,
            nodeId: data.nodeId || "",
            rawMemo: data.rawMemo || "",
            situation: data.situation || "",
            task: data.task || "",
            action: data.action || "",
            result: data.result || "",
            question: data.question || "",
            nextTodo: data.nextTodo || "",
            talked: data.talked === undefined ? false : data.talked,
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
          });
        });
        return logs.sort((a, b) => b.createdAt - a.createdAt);
      } catch (err) {
        console.error("Firestore getLogs failed, falling back to Mock", err);
      }
    }

    // LocalStorage fallback
    const stored = localStorage.getItem(`logs_${projectId}`);
    return stored ? JSON.parse(stored) : [];
  },

  async createLog(
    projectId: string,
    nodeId: string,
    rawMemo: string,
    situation: string,
    task: string,
    action: string,
    result: string,
    question?: string,
    nextTodo?: string,
    customId?: string,
    customCreatedAt?: number,
    talked?: boolean
  ): Promise<ProgressLog> {
    const id = customId || generateId();
    const createdAt = customCreatedAt || Date.now();
    const isTalked = talked === undefined ? false : talked;
    const newLog: ProgressLog = {
      id,
      nodeId,
      rawMemo,
      situation,
      task,
      action,
      result,
      question,
      nextTodo,
      createdAt,
      talked: isTalked,
    };

    const mode = getStoragePreference();
    if (mode === "firebase" && db) {
      try {
        await setDoc(doc(db, "projects", projectId, "logs", id), {
          nodeId,
          rawMemo,
          situation,
          task,
          action,
          result,
          question: question || "",
          nextTodo: nextTodo || "",
          createdAt: new Date(createdAt),
          talked: isTalked,
        });
        return newLog;
      } catch (err) {
        console.error("Firestore createLog failed", err);
      }
    }

    // LocalStorage fallback
    const list = await this.getLogs(projectId);
    list.unshift(newLog);
    localStorage.setItem(`logs_${projectId}`, JSON.stringify(list));
    return newLog;
  },

  async updateLog(projectId: string, logId: string, fields: Partial<Omit<ProgressLog, "id" | "createdAt">>): Promise<void> {
    const mode = getStoragePreference();
    if (mode === "firebase" && db) {
      try {
        const docRef = doc(db, "projects", projectId, "logs", logId);
        await updateDoc(docRef, fields);
        return;
      } catch (err) {
        console.error("Firestore updateLog failed", err);
      }
    }

    // LocalStorage fallback
    const list = await this.getLogs(projectId);
    const index = list.findIndex((l) => l.id === logId);
    if (index !== -1) {
      list[index] = { ...list[index], ...fields };
      localStorage.setItem(`logs_${projectId}`, JSON.stringify(list));
    }
  },

  async deleteLog(projectId: string, logId: string): Promise<void> {
    const mode = getStoragePreference();
    if (mode === "firebase" && db) {
      try {
        await deleteDoc(doc(db, "projects", projectId, "logs", logId));
        return;
      } catch (err) {
        console.error("Firestore deleteLog failed", err);
      }
    }

    // LocalStorage fallback
    const list = await this.getLogs(projectId);
    const filtered = list.filter((l) => l.id !== logId);
    localStorage.setItem(`logs_${projectId}`, JSON.stringify(filtered));
  },
};
