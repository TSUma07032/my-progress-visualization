/* eslint-disable @typescript-eslint/no-unused-vars */
import { Project, ProjectNode, ProgressLog } from "./types";
import { getSupabase } from "./supabase";

export type DBMode = "supabase";

let currentStoragePreference: DBMode = "supabase";

export const getStoragePreference = (): DBMode => {
  return currentStoragePreference;
};

export const setStoragePreference = (_mode: DBMode) => {
  currentStoragePreference = _mode;
};

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
};

export const dbService = {
  // PROJECTS
  async getProjects(): Promise<Project[]> {
    if (getSupabase()) {
      try {
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
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

  async getProject(mode: DBMode = "supabase", id: string): Promise<Project | null> {
    if (getSupabase()) {
      try {
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
        const { data, error } = await supa.from("projects").select("*").eq("id", id).single();
        if (error) throw error;
        return {
          id: data.id,
          title: data.title,
          createdAt: new Date(data.created_at).getTime(),
          updatedAt: new Date(data.updated_at).getTime(),
        };
      } catch (err) {
        console.error("Supabase getProject error", err);
      }
    }
    return null;
  },

  async createProject(mode: DBMode = "supabase", title: string): Promise<Project> {
    const newProject: Project = {
      id: generateId(),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (getSupabase()) {
      try {
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
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

  async updateProject(mode: DBMode = "supabase", id: string, title: string): Promise<void> {
    if (getSupabase()) {
      try {
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
        const { error } = await supa.from("projects")
          .update({ title, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase updateProject error", err);
      }
    }
  },

  async deleteProject(mode: DBMode = "supabase", id: string): Promise<void> {
    if (getSupabase()) {
      try {
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
        const { error } = await supa.from("projects").delete().eq("id", id);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase deleteProject error", err);
      }
    }
  },

  // NODES
  async getNodes(mode: DBMode = "supabase", projectId: string): Promise<ProjectNode[]> {
    if (getSupabase()) {
      try {
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
        const { data, error } = await supa.from("nodes").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(d => ({
          id: d.id,
          parentId: d.parent_id,
          label: d.label,
          summary: d.summary || undefined,
          createdAt: new Date(d.created_at).getTime(),
        }));
      } catch (err) {
        console.error("Supabase getNodes error", err);
      }
    }
    return [];
  },

  async createNode(mode: DBMode = "supabase", projectId: string, label: string, parentId: string | null = null): Promise<ProjectNode> {
    const newNode: ProjectNode = {
      id: generateId(),
      parentId,
      label,
      createdAt: Date.now(),
    };

    if (getSupabase()) {
      try {
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
        const { error } = await supa.from("nodes").insert({
          id: newNode.id,
          project_id: projectId,
          parent_id: parentId,
          label,
          created_at: new Date(newNode.createdAt).toISOString(),
        });
        if (error) throw error;
      } catch (err) {
        console.error("Supabase createNode error", err);
      }
    }
    return newNode;
  },

  async updateNode(mode: DBMode = "supabase", projectId: string, nodeId: string, fields: Partial<Omit<ProjectNode, "id" | "createdAt">>): Promise<void> {
    if (getSupabase()) {
      try {
        const payload: Record<string, unknown> = {};
        if (fields.label !== undefined) payload.label = fields.label;
        if (fields.parentId !== undefined) payload.parent_id = fields.parentId;
        if (fields.summary !== undefined) payload.summary = fields.summary;
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
        const { error } = await supa.from("nodes")
          .update(payload)
          .eq("id", nodeId)
          .eq("project_id", projectId);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase updateNode error", err);
      }
    }
  },

  async deleteNode(mode: DBMode = "supabase", projectId: string, nodeId: string): Promise<void> {
    if (getSupabase()) {
      try {
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
        const { error } = await supa.from("nodes").delete().eq("id", nodeId).eq("project_id", projectId);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase deleteNode error", err);
      }
    }
  },

  // LOGS
  async getLogs(mode: DBMode = "supabase", projectId: string): Promise<ProgressLog[]> {
    if (getSupabase()) {
      try {
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
        const { data, error } = await supa.from("logs").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []).map(d => ({
          id: d.id,
          nodeId: d.node_id,
          rawMemo: d.raw_memo,
          situation: d.situation,
          task: d.task,
          action: d.action,
          result: d.result,
          question: d.question,
          nextTodo: d.next_todo,
          talked: d.talked,
          createdAt: new Date(d.created_at).getTime(),
        }));
      } catch (err) {
        console.error("Supabase getLogs error", err);
      }
    }
    return [];
  },

  async createLog(
    mode: DBMode = "supabase",
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

    if (getSupabase()) {
      try {
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
        const { error } = await supa.from("logs").insert({
          id,
          project_id: projectId,
          node_id: nodeId,
          raw_memo: rawMemo,
          situation,
          task,
          action,
          result,
          question: question || null,
          next_todo: nextTodo || null,
          talked: isTalked,
          created_at: new Date(createdAt).toISOString(),
        });
        if (error) throw error;
      } catch (err) {
        console.error("Supabase createLog error", err);
      }
    }
    return newLog;
  },

  async updateLog(mode: DBMode = "supabase", projectId: string, logId: string, updateData: Partial<Omit<ProgressLog, "id" | "createdAt">>): Promise<void> {
    if (getSupabase()) {
      try {
        const updatePayload: Record<string, unknown> = {};
        if (updateData.nodeId !== undefined) updatePayload.node_id = updateData.nodeId;
        if (updateData.rawMemo !== undefined) updatePayload.raw_memo = updateData.rawMemo;
        if (updateData.situation !== undefined) updatePayload.situation = updateData.situation;
        if (updateData.task !== undefined) updatePayload.task = updateData.task;
        if (updateData.action !== undefined) updatePayload.action = updateData.action;
        if (updateData.result !== undefined) updatePayload.result = updateData.result;
        if (updateData.question !== undefined) updatePayload.question = updateData.question;
        if (updateData.nextTodo !== undefined) updatePayload.next_todo = updateData.nextTodo;
        if (updateData.talked !== undefined) updatePayload.talked = updateData.talked;

        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
        const { error } = await supa.from("logs")
          .update(updatePayload)
          .eq("id", logId)
          .eq("project_id", projectId);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase updateLog error", err);
      }
    }
  },

  async deleteLog(mode: DBMode = "supabase", projectId: string, logId: string): Promise<void> {
    if (getSupabase()) {
      try {
        const supa = getSupabase();
        if (!supa) throw new Error("Supabase is not initialized");
        const { error } = await supa.from("logs").delete().eq("id", logId).eq("project_id", projectId);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase deleteLog error", err);
      }
    }
  },
};
