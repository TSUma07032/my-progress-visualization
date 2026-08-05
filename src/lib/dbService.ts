import { Project, WbsNode, Todo } from "./types";
import { getSupabase } from "./supabase";
import { LexoRank } from "lexorank";

export const dbService = {
  // PROJECTS
  async getProjects(): Promise<Project[]> {
    const supa = getSupabase();
    if (!supa) throw new Error("Supabase is not initialized");
    const { data, error } = await supa.from("projects").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createProject(name: string): Promise<Project> {
    const supa = getSupabase();
    if (!supa) throw new Error("Supabase is not initialized");
    const { data, error } = await supa.from("projects").insert({ name }).select().single();
    if (error) throw error;
    return data;
  },

  // WBS NODES
  async getWbsNodes(projectId: string): Promise<WbsNode[]> {
    const supa = getSupabase();
    if (!supa) throw new Error("Supabase is not initialized");
    const { data, error } = await supa.from("wbs_nodes").select("*").eq("project_id", projectId).order("order_rank", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createWbsNode(projectId: string, parentId: string | null, nodeLevel: number, title: string): Promise<WbsNode> {
    const supa = getSupabase();
    if (!supa) throw new Error("Supabase is not initialized");

    // Determine the next order_rank
    const { data: existingNodes, error: fetchError } = await supa.from("wbs_nodes")
      .select("order_rank")
      .eq("project_id", projectId)
      .is("parent_id", parentId)
      .order("order_rank", { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;

    let nextRank = LexoRank.middle().toString();
    if (existingNodes && existingNodes.length > 0) {
      const highestRank = LexoRank.parse(existingNodes[0].order_rank);
      nextRank = highestRank.genNext().toString();
    }

    const { data, error } = await supa.from("wbs_nodes").insert({
      project_id: projectId,
      parent_id: parentId,
      node_level: nodeLevel,
      title,
      order_rank: nextRank,
    }).select().single();

    if (error) throw error;
    return data;
  },

  async updateWbsNode(nodeId: string, projectId: string, fields: Partial<WbsNode>): Promise<void> {
    const supa = getSupabase();
    if (!supa) throw new Error("Supabase is not initialized");
    const { error } = await supa.from("wbs_nodes")
      .update(fields)
      .eq("id", nodeId)
      .eq("project_id", projectId);
    if (error) throw error;
  },

  async deleteWbsNode(nodeId: string, projectId: string): Promise<void> {
    const supa = getSupabase();
    if (!supa) throw new Error("Supabase is not initialized");
    const { error } = await supa.from("wbs_nodes").delete().eq("id", nodeId).eq("project_id", projectId);
    if (error) throw error;
  },

  async reorderNode(nodeId: string, projectId: string, newParentId: string | null, previousNodeRank: string | null, nextNodeRank: string | null, newNodeLevel: number): Promise<string> {
    const supa = getSupabase();
    if (!supa) throw new Error("Supabase is not initialized");

    let newRank: LexoRank;
    if (!previousNodeRank && !nextNodeRank) {
       newRank = LexoRank.middle();
    } else if (!previousNodeRank) {
       newRank = LexoRank.parse(nextNodeRank!).genPrev();
    } else if (!nextNodeRank) {
       newRank = LexoRank.parse(previousNodeRank).genNext();
    } else {
       newRank = LexoRank.parse(previousNodeRank).between(LexoRank.parse(nextNodeRank));
    }

    const rankString = newRank.toString();

    const { error } = await supa.from("wbs_nodes")
      .update({
        parent_id: newParentId,
        order_rank: rankString,
        node_level: newNodeLevel
      })
      .eq("id", nodeId)
      .eq("project_id", projectId);

    if (error) throw error;
    return rankString;
  },

  // TODOS
  async getTodos(nodeId: string): Promise<Todo[]> {
    const supa = getSupabase();
    if (!supa) throw new Error("Supabase is not initialized");
    const { data, error } = await supa.from("todos").select("*").eq("node_id", nodeId).order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createTodo(nodeId: string, content: string | null = null): Promise<Todo> {
    const supa = getSupabase();
    if (!supa) throw new Error("Supabase is not initialized");
    const { data, error } = await supa.from("todos").insert({
      node_id: nodeId,
      content,
    }).select().single();
    if (error) throw error;
    return data;
  },

  async updateTodo(todoId: string, fields: Partial<Todo>): Promise<void> {
    const supa = getSupabase();
    if (!supa) throw new Error("Supabase is not initialized");
    const { error } = await supa.from("todos")
      .update(fields)
      .eq("id", todoId);
    if (error) throw error;
  },

  async deleteTodo(todoId: string): Promise<void> {
    const supa = getSupabase();
    if (!supa) throw new Error("Supabase is not initialized");
    const { error } = await supa.from("todos").delete().eq("id", todoId);
    if (error) throw error;
  }
};
