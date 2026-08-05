"use client";

import React, { useState, useEffect } from "react";
import { WbsNode, Todo, WbsNodeWithNumber, Project } from "../lib/types";
import { dbService } from "../lib/dbService";
import { WbsTree } from "../components/WbsTree";
import { PlusCircle, Loader2, FolderPlus, FolderOpen, Save, CheckSquare } from "lucide-react";
import MDEditor from "@uiw/react-md-editor";

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<WbsNode[]>([]);
  const [activeNode, setActiveNode] = useState<WbsNodeWithNumber | null>(null);

  // Right pane state
  const [todos, setTodos] = useState<Todo[]>([]);
  const [markdownDoc, setMarkdownDoc] = useState<string>("");
  const [todoDocId, setTodoDocId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");

  // Initialize
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const projs = await dbService.getProjects();
      setProjects(projs);
      if (projs.length > 0) {
        selectProject(projs[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectProject = async (id: string) => {
    setCurrentProjectId(id);
    setActiveNode(null);
    setTodos([]);
    try {
      const wbsNodes = await dbService.getWbsNodes(id);
      setNodes(wbsNodes);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;
    try {
      const p = await dbService.createProject(newProjectTitle.trim());
      setProjects([p, ...projects]);
      selectProject(p.id);
      setShowAddProjectModal(false);
      setNewProjectTitle("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRootNode = async () => {
    if (!currentProjectId) return;
    const title = prompt("新しい大項目（フェーズ）のタイトルを入力してください");
    if (!title) return;
    try {
      const newNode = await dbService.createWbsNode(currentProjectId, null, 2, title);
      setNodes([...nodes, newNode]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddChildNode = async (parentId: string, parentLevel: number) => {
    if (!currentProjectId) return;
    if (parentLevel >= 4) {
      alert("これ以上の階層は作成できません。");
      return;
    }
    const title = prompt("新しい項目のタイトルを入力してください");
    if (!title) return;
    try {
      const newNode = await dbService.createWbsNode(currentProjectId, parentId, parentLevel + 1, title);
      setNodes([...nodes, newNode]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectNode = async (node: WbsNodeWithNumber) => {
    setActiveNode(node);
    try {
      const t = await dbService.getTodos(node.id);
      if (t.length > 0) {
        // Assume first todo is the main document for this node in this phase
        setTodoDocId(t[0].id);
        setMarkdownDoc(t[0].content || "");
      } else {
        // Create an empty doc
        const newTodo = await dbService.createTodo(node.id, "");
        setTodoDocId(newTodo.id);
        setMarkdownDoc("");
      }
      setTodos(t); // Keep full list if we expand to checklist items later
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDoc = async () => {
    if (!todoDocId) return;
    try {
      await dbService.updateTodo(todoDocId, { content: markdownDoc });
      alert("保存しました");
    } catch(err) {
      console.error(err);
    }
  };

  const handleNodeStatusChange = async (status: WbsNode['status']) => {
    if (!activeNode || !currentProjectId) return;
    try {
      await dbService.updateWbsNode(activeNode.id, currentProjectId, { status });
      setNodes(nodes.map(n => n.id === activeNode.id ? { ...n, status } : n));
      setActiveNode({...activeNode, status});
    } catch(err) {
       console.error(err);
    }
  };

  const onReorder = async (nodeId: string, newParentId: string | null, prevRank: string | null, nextRank: string | null, newLevel: number) => {
    if (!currentProjectId) return;

    // Optimistic update logic could go here
    try {
      await dbService.reorderNode(nodeId, currentProjectId, newParentId, prevRank, nextRank, newLevel);
      // Refresh tree
      const updatedNodes = await dbService.getWbsNodes(currentProjectId);
      setNodes(updatedNodes);
    } catch (err) {
      console.error("Reorder failed", err);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-100"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  // To prevent TS errors on unused var (it will be used when we add inline todos)
  const _unusedTodos = todos;

  return (
    <div className="flex h-screen bg-white text-slate-800 font-sans overflow-hidden">
      {/* 2-Pane Layout */}

      {/* Left Pane: WBS Tree */}
      <div className="w-1/3 flex flex-col border-r border-slate-200 bg-slate-50">
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="font-black text-lg flex items-center gap-2">
              <span className="text-emerald-600">WBS</span> Tracker
            </h1>
            <button
              onClick={() => setShowAddProjectModal(true)}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-emerald-600 transition"
              title="新規プロジェクト"
            >
              <FolderPlus className="w-5 h-5" />
            </button>
          </div>

          <select
            className="w-full bg-slate-100 border-none rounded-lg p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            value={currentProjectId || ""}
            onChange={(e) => selectProject(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
           {currentProjectId ? (
             <>
               <div className="p-2 flex justify-between items-center border-b border-slate-100 bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2">Structure</span>
                  <button
                    onClick={handleAddRootNode}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1 transition"
                  >
                    <PlusCircle className="w-3 h-3" />
                    フェーズ追加
                  </button>
               </div>
               <WbsTree
                 nodes={nodes}
                 activeNodeId={activeNode?.id || null}
                 onSelectNode={handleSelectNode}
                 onReorder={onReorder}
               />
             </>
           ) : (
             <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
               <FolderOpen className="w-12 h-12 opacity-20" />
               <p className="text-sm font-medium">プロジェクトを選択または作成してください</p>
             </div>
           )}
        </div>
      </div>

      {/* Right Pane: Details & Docs */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {activeNode ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                <span className="bg-slate-100 px-2 py-1 rounded">{activeNode.wbs_number}</span>
                <span>Level {activeNode.node_level}</span>
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black text-slate-800">{activeNode.title}</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={activeNode.status}
                    onChange={(e) => handleNodeStatusChange(e.target.value as any)}
                    className="border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="not_started">未着手</option>
                    <option value="in_progress">進行中</option>
                    <option value="completed">完了</option>
                  </select>

                  {activeNode.node_level < 4 && (
                    <button
                      onClick={() => handleAddChildNode(activeNode.id, activeNode.node_level)}
                      className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold px-4 py-2 rounded-lg text-sm transition flex items-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      子ノード追加
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
              <div className="max-w-4xl mx-auto space-y-8">

                {/* Level 4 Tasks (Checklist UI concept) */}
                {activeNode.children && activeNode.children.length > 0 && activeNode.node_level === 3 && (
                   <div className="space-y-3">
                     <h3 className="font-bold text-slate-700 flex items-center gap-2">
                       <CheckSquare className="w-5 h-5 text-emerald-500" />
                       サブタスク一覧
                     </h3>
                     <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-sm">
                       {activeNode.children.map(child => (
                         <div key={child.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg group border-b border-slate-50 last:border-0">
                           <div className="flex items-center gap-3">
                             <input
                               type="checkbox"
                               checked={child.status === 'completed'}
                               onChange={() => {
                                 const nextStatus = child.status === 'completed' ? 'not_started' : 'completed';
                                 dbService.updateWbsNode(child.id, currentProjectId!, { status: nextStatus }).then(() => {
                                    setNodes(nodes.map(n => n.id === child.id ? { ...n, status: nextStatus } : n));
                                    handleSelectNode({...activeNode, children: activeNode.children?.map(c => c.id === child.id ? {...c, status: nextStatus} : c)});
                                 });
                               }}
                               className="w-5 h-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                             />
                             <span className={`font-medium ${child.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                               {child.wbs_number} {child.title}
                             </span>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                )}

                {/* Document / Markdown Area */}
                <div className="space-y-3 flex flex-col h-[600px]">
                   <div className="flex items-center justify-between">
                     <h3 className="font-bold text-slate-700">ドキュメント・課題メモ</h3>
                     <button
                       onClick={handleSaveDoc}
                       className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition"
                     >
                       <Save className="w-4 h-4" />
                       保存する
                     </button>
                   </div>
                   <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" data-color-mode="light">
                     <MDEditor
                        value={markdownDoc}
                        onChange={(val) => setMarkdownDoc(val || "")}
                        height="100%"
                        className="h-full border-none"
                     />
                   </div>
                </div>

              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <p className="text-sm font-medium">左側のツリーからノードを選択してください</p>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-black text-slate-800">新規プロジェクト</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <input
                type="text"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="プロジェクト名"
                className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAddProjectModal(false)} className="px-4 py-2 text-slate-500">キャンセル</button>
                <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold">作成</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
