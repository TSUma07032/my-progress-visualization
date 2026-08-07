import { Project, Phase, Deliverable, Task } from "./types";
import { getSupabase } from "./supabase";

export type DBMode = "supabase" | "mock";

const generateId = () => Math.random().toString(36).substring(2, 15);

// ---------------------------------------------------------
// MOCK DATA STORAGE
// ---------------------------------------------------------
let mockProjects: Project[] = [];
let mockPhases: Phase[] = [];
let mockDeliverables: Deliverable[] = [];
let mockTasks: Task[] = [];

// Load from LocalStorage if in browser
if (typeof window !== "undefined") {
  try {
    mockProjects = JSON.parse(localStorage.getItem("mock_projects") || "[]");
    mockPhases = JSON.parse(localStorage.getItem("mock_phases") || "[]");
    mockDeliverables = JSON.parse(localStorage.getItem("mock_deliverables") || "[]");
    mockTasks = JSON.parse(localStorage.getItem("mock_tasks") || "[]");
  } catch (e) {
    console.error("Failed to parse mock data from localStorage", e);
  }
}

const saveMockData = () => {
  if (typeof window !== "undefined") {
    localStorage.setItem("mock_projects", JSON.stringify(mockProjects));
    localStorage.setItem("mock_phases", JSON.stringify(mockPhases));
    localStorage.setItem("mock_deliverables", JSON.stringify(mockDeliverables));
    localStorage.setItem("mock_tasks", JSON.stringify(mockTasks));
  }
};

let currentStoragePreference: DBMode = "supabase";

export const setStoragePreference = (mode: DBMode) => {
  currentStoragePreference = mode;
  if (typeof window !== "undefined") {
    localStorage.setItem("storage_preference", mode);
  }
};

export const getStoragePreference = (): DBMode => {
  if (typeof window !== "undefined") {
    const p = localStorage.getItem("storage_preference");
    if (p === "mock" || p === "supabase") return p;
  }
  return currentStoragePreference;
};

// ---------------------------------------------------------
// DB SERVICE
// ---------------------------------------------------------

export const dbService = {
  // ---------------------------------------------------------
  // PROJECTS
  // ---------------------------------------------------------
  async getProjects(mode: DBMode = getStoragePreference()): Promise<Project[]> {
    console.log(`[dbService] getProjects mode=${mode}`);
    if (mode === "mock") return [...mockProjects].sort((a, b) => b.createdAt - a.createdAt);

    if (getSupabase()) {
      try {
        const supa = getSupabase()!;
        const { data, error } = await supa.from("projects").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []).map(d => ({
          id: d.id,
          title: d.title,
          createdAt: new Date(d.created_at).getTime(),
          updatedAt: new Date(d.updated_at).getTime(),
        }));
      } catch (err) {
        console.error("Supabase getProjects error", err);
      }
    }
    return [];
  },

  async createProject(title: string, mode: DBMode = getStoragePreference()): Promise<Project> {
    console.log(`[dbService] createProject mode=${mode}, title=${title}`);
    const newProject: Project = { id: generateId(), title, createdAt: Date.now(), updatedAt: Date.now() };

    if (mode === "mock") {
      mockProjects.push(newProject);
      saveMockData();
      return newProject;
    }

    if (getSupabase()) {
      try {
        const supa = getSupabase()!;
        const { error } = await supa.from("projects").insert({
          id: newProject.id,
          title: newProject.title,
          created_at: new Date(newProject.createdAt).toISOString(),
          updated_at: new Date(newProject.updatedAt).toISOString(),
        });
        if (error) throw error;
      } catch (err) {
        console.error("Supabase createProject error", err);
      }
    }
    return newProject;
  },

  async deleteProject(id: string, mode: DBMode = getStoragePreference()): Promise<void> {
    console.log(`[dbService] deleteProject mode=${mode}, id=${id}`);
    if (mode === "mock") {
      mockProjects = mockProjects.filter(p => p.id !== id);
      // Cascade manually for mock
      mockPhases = mockPhases.filter(ph => ph.projectId !== id);
      const remainingPhases = new Set(mockPhases.map(p => p.id));
      mockDeliverables = mockDeliverables.filter(d => remainingPhases.has(d.phaseId));
      const remainingDelivs = new Set(mockDeliverables.map(d => d.id));
      mockTasks = mockTasks.filter(t => remainingDelivs.has(t.deliverableId));
      saveMockData();
      return;
    }

    if (getSupabase()) {
      try {
        const { error } = await getSupabase()!.from("projects").delete().eq("id", id);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase deleteProject error", err);
      }
    }
  },

  // ---------------------------------------------------------
  // PHASES
  // ---------------------------------------------------------
  async getPhases(projectId: string, mode: DBMode = getStoragePreference()): Promise<Phase[]> {
    console.log(`[dbService] getPhases mode=${mode}, projectId=${projectId}`);
    if (mode === "mock") return mockPhases.filter(p => p.projectId === projectId).sort((a, b) => a.createdAt - b.createdAt);

    if (getSupabase()) {
      try {
        const { data, error } = await getSupabase()!.from("phases").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(d => ({
          id: d.id, projectId: d.project_id, title: d.title, summary: d.summary || undefined,
          createdAt: new Date(d.created_at).getTime(), updatedAt: new Date(d.updated_at).getTime()
        }));
      } catch (err) {
        console.error("Supabase getPhases error", err);
      }
    }
    return [];
  },

  async createPhase(projectId: string, title: string, mode: DBMode = getStoragePreference()): Promise<Phase> {
    console.log(`[dbService] createPhase mode=${mode}, projectId=${projectId}, title=${title}`);
    const newPhase: Phase = { id: generateId(), projectId, title, createdAt: Date.now(), updatedAt: Date.now() };

    if (mode === "mock") {
      mockPhases.push(newPhase);
      saveMockData();
      return newPhase;
    }

    if (getSupabase()) {
      try {
        const { error } = await getSupabase()!.from("phases").insert({
          id: newPhase.id, project_id: newPhase.projectId, title: newPhase.title,
          created_at: new Date(newPhase.createdAt).toISOString(), updated_at: new Date(newPhase.updatedAt).toISOString()
        });
        if (error) throw error;
      } catch (err) {
        console.error("Supabase createPhase error", err);
      }
    }
    return newPhase;
  },

  async updatePhaseSummary(phaseId: string, summary: string, mode: DBMode = getStoragePreference()): Promise<void> {
    console.log(`[dbService] updatePhaseSummary mode=${mode}, phaseId=${phaseId}`);
    if (mode === "mock") {
      const idx = mockPhases.findIndex(p => p.id === phaseId);
      if (idx !== -1) {
        mockPhases[idx] = { ...mockPhases[idx], summary, updatedAt: Date.now() };
        saveMockData();
      }
      return;
    }

    if (getSupabase()) {
      try {
        const { error } = await getSupabase()!.from("phases").update({ summary, updated_at: new Date().toISOString() }).eq("id", phaseId);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase updatePhaseSummary error", err);
      }
    }
  },

  async deletePhase(phaseId: string, mode: DBMode = getStoragePreference()): Promise<void> {
    console.log(`[dbService] deletePhase mode=${mode}, phaseId=${phaseId}`);
    if (mode === "mock") {
      mockPhases = mockPhases.filter(p => p.id !== phaseId);
      mockDeliverables = mockDeliverables.filter(d => d.phaseId !== phaseId);
      const remainingDelivs = new Set(mockDeliverables.map(d => d.id));
      mockTasks = mockTasks.filter(t => remainingDelivs.has(t.deliverableId));
      saveMockData();
      return;
    }

    if (getSupabase()) {
      try {
        const { error } = await getSupabase()!.from("phases").delete().eq("id", phaseId);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase deletePhase error", err);
      }
    }
  },

  // ---------------------------------------------------------
  // DELIVERABLES
  // ---------------------------------------------------------
  async getDeliverables(phaseId: string, mode: DBMode = getStoragePreference()): Promise<Deliverable[]> {
    console.log(`[dbService] getDeliverables mode=${mode}, phaseId=${phaseId}`);
    if (mode === "mock") return mockDeliverables.filter(d => d.phaseId === phaseId).sort((a, b) => a.createdAt - b.createdAt);

    if (getSupabase()) {
      try {
        const { data, error } = await getSupabase()!.from("deliverables").select("*").eq("phase_id", phaseId).order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(d => ({
          id: d.id, phaseId: d.phase_id, title: d.title, summary: d.summary || undefined,
          createdAt: new Date(d.created_at).getTime(), updatedAt: new Date(d.updated_at).getTime()
        }));
      } catch (err) {
        console.error("Supabase getDeliverables error", err);
      }
    }
    return [];
  },

  async createDeliverable(phaseId: string, title: string, mode: DBMode = getStoragePreference()): Promise<Deliverable> {
    console.log(`[dbService] createDeliverable mode=${mode}, phaseId=${phaseId}, title=${title}`);
    const newDeliv: Deliverable = { id: generateId(), phaseId, title, createdAt: Date.now(), updatedAt: Date.now() };

    if (mode === "mock") {
      mockDeliverables.push(newDeliv);
      saveMockData();
      return newDeliv;
    }

    if (getSupabase()) {
      try {
        const { error } = await getSupabase()!.from("deliverables").insert({
          id: newDeliv.id, phase_id: newDeliv.phaseId, title: newDeliv.title,
          created_at: new Date(newDeliv.createdAt).toISOString(), updated_at: new Date(newDeliv.updatedAt).toISOString()
        });
        if (error) throw error;
      } catch (err) {
        console.error("Supabase createDeliverable error", err);
      }
    }
    return newDeliv;
  },

  async updateDeliverableSummary(deliverableId: string, summary: string, mode: DBMode = getStoragePreference()): Promise<void> {
    console.log(`[dbService] updateDeliverableSummary mode=${mode}, deliverableId=${deliverableId}`);
    if (mode === "mock") {
      const idx = mockDeliverables.findIndex(d => d.id === deliverableId);
      if (idx !== -1) {
        mockDeliverables[idx] = { ...mockDeliverables[idx], summary, updatedAt: Date.now() };
        saveMockData();
      }
      return;
    }

    if (getSupabase()) {
      try {
        const { error } = await getSupabase()!.from("deliverables").update({ summary, updated_at: new Date().toISOString() }).eq("id", deliverableId);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase updateDeliverableSummary error", err);
      }
    }
  },

  async deleteDeliverable(deliverableId: string, mode: DBMode = getStoragePreference()): Promise<void> {
    console.log(`[dbService] deleteDeliverable mode=${mode}, deliverableId=${deliverableId}`);
    if (mode === "mock") {
      mockDeliverables = mockDeliverables.filter(d => d.id !== deliverableId);
      mockTasks = mockTasks.filter(t => t.deliverableId !== deliverableId);
      saveMockData();
      return;
    }

    if (getSupabase()) {
      try {
        const { error } = await getSupabase()!.from("deliverables").delete().eq("id", deliverableId);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase deleteDeliverable error", err);
      }
    }
  },

  // ---------------------------------------------------------
  // TASKS
  // ---------------------------------------------------------
  async getTasks(deliverableId: string, mode: DBMode = getStoragePreference()): Promise<Task[]> {
    console.log(`[dbService] getTasks mode=${mode}, deliverableId=${deliverableId}`);
    if (mode === "mock") return mockTasks.filter(t => t.deliverableId === deliverableId).sort((a, b) => a.createdAt - b.createdAt);

    if (getSupabase()) {
      try {
        const { data, error } = await getSupabase()!.from("tasks").select("*").eq("deliverable_id", deliverableId).order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(d => ({
          id: d.id, deliverableId: d.deliverable_id, title: d.title, content: d.content || undefined,
          status: d.status as any, createdAt: new Date(d.created_at).getTime(), updatedAt: new Date(d.updated_at).getTime()
        }));
      } catch (err) {
        console.error("Supabase getTasks error", err);
      }
    }
    return [];
  },

  async createTask(deliverableId: string, title: string, content?: string, mode: DBMode = getStoragePreference()): Promise<Task> {
    console.log(`[dbService] createTask mode=${mode}, deliverableId=${deliverableId}, title=${title}`);
    const newTask: Task = { id: generateId(), deliverableId, title, content, status: 'todo', createdAt: Date.now(), updatedAt: Date.now() };

    if (mode === "mock") {
      mockTasks.push(newTask);
      saveMockData();
      return newTask;
    }

    if (getSupabase()) {
      try {
        const { error } = await getSupabase()!.from("tasks").insert({
          id: newTask.id, deliverable_id: newTask.deliverableId, title: newTask.title, content: newTask.content, status: newTask.status,
          created_at: new Date(newTask.createdAt).toISOString(), updated_at: new Date(newTask.updatedAt).toISOString()
        });
        if (error) throw error;
      } catch (err) {
        console.error("Supabase createTask error", err);
      }
    }
    return newTask;
  },

  async updateTaskStatus(taskId: string, status: 'todo' | 'in_progress' | 'done', mode: DBMode = getStoragePreference()): Promise<void> {
    console.log(`[dbService] updateTaskStatus mode=${mode}, taskId=${taskId}, status=${status}`);
    if (mode === "mock") {
      const idx = mockTasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        mockTasks[idx] = { ...mockTasks[idx], status, updatedAt: Date.now() };
        saveMockData();
      }
      return;
    }

    if (getSupabase()) {
      try {
        const { error } = await getSupabase()!.from("tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", taskId);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase updateTaskStatus error", err);
      }
    }
  },

  async deleteTask(taskId: string, mode: DBMode = getStoragePreference()): Promise<void> {
    console.log(`[dbService] deleteTask mode=${mode}, taskId=${taskId}`);
    if (mode === "mock") {
      mockTasks = mockTasks.filter(t => t.id !== taskId);
      saveMockData();
      return;
    }

    if (getSupabase()) {
      try {
        const { error } = await getSupabase()!.from("tasks").delete().eq("id", taskId);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase deleteTask error", err);
      }
    }
  }
};
