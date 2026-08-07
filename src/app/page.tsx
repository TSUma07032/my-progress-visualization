"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { dbService } from "../lib/dbService";
import { Project, Phase, Deliverable, Task, SelectedNode } from "../lib/types";
import {
  Folder, FolderOpen, FileText, CheckSquare, Plus, Edit3, Trash2, Settings, Lock, Unlock, Loader2, Sparkles, AlertTriangle, X
} from "lucide-react";

export default function Home() {
  const {
    isCreator, geminiApiKey, storageMode, isMounted,
    setStorageMode, unlockCreator, lockCreator, saveGeminiApiKey,
    supabaseUrl, supabaseKey, saveSupabaseConfig, clearSupabaseConfig,
  } = useApp();

  const [projects, setProjects] = useState<Project[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);

  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  // Settings Modals
  const [showSettings, setShowSettings] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [supabaseUrlInput, setSupabaseUrlInput] = useState("");
  const [supabaseKeyInput, setSupabaseKeyInput] = useState("");

  useEffect(() => {
    if (isMounted) {
      setGeminiKeyInput(geminiApiKey);
      setSupabaseUrlInput(supabaseUrl);
      setSupabaseKeyInput(supabaseKey);
    }
  }, [isMounted, geminiApiKey, supabaseUrl, supabaseKey]);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      const ps = await dbService.getProjects(storageMode);
      setProjects(ps);

      let allPhases: Phase[] = [];
      for (const p of ps) {
        const phs = await dbService.getPhases(p.id, storageMode);
        allPhases = [...allPhases, ...phs];
      }
      setPhases(allPhases);

      let allDelivs: Deliverable[] = [];
      for (const ph of allPhases) {
        const ds = await dbService.getDeliverables(ph.id, storageMode);
        allDelivs = [...allDelivs, ...ds];
      }
      setDeliverables(allDelivs);

      let allTasks: Task[] = [];
      for (const d of allDelivs) {
        const ts = await dbService.getTasks(d.id, storageMode);
        allTasks = [...allTasks, ...ts];
      }
      setTasks(allTasks);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = async () => {
    const title = prompt("プロジェクト名を入力してください:");
    if (!title) return;
    await dbService.createProject(title, storageMode);
    loadData();
  };

  const handleAddPhase = async (projectId: string) => {
    const title = prompt("フェーズ/大項目名を入力してください:");
    if (!title) return;
    await dbService.createPhase(projectId, title, storageMode);
    loadData();
  };

  const handleAddDeliverable = async (phaseId: string) => {
    const title = prompt("成果物/中項目名を入力してください:");
    if (!title) return;
    await dbService.createDeliverable(phaseId, title, storageMode);
    loadData();
  };

  const handleAddTask = async (deliverableId: string) => {
    const title = prompt("進捗/小項目名を入力してください:");
    if (!title) return;
    const content = prompt("詳細（任意）:") || undefined;
    await dbService.createTask(deliverableId, title, content, storageMode);
    loadData();
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm("本当に削除しますか？子項目もすべて削除されます。")) return;
    if (type === 'project') await dbService.deleteProject(id, storageMode);
    else if (type === 'phase') await dbService.deletePhase(id, storageMode);
    else if (type === 'deliverable') await dbService.deleteDeliverable(id, storageMode);
    else if (type === 'task') await dbService.deleteTask(id, storageMode);

    if (selectedNode?.id === id) setSelectedNode(null);
    loadData();
  };

  const generateSummary = async (type: 'phase' | 'deliverable', id: string) => {
    setSummarizing(true);
    try {
      let targetTitle = "";
      let children = [];

      if (type === 'phase') {
        const p = phases.find(x => x.id === id);
        if (!p) return;
        targetTitle = p.title;
        children = deliverables.filter(d => d.phaseId === id);
      } else {
        const d = deliverables.find(x => x.id === id);
        if (!d) return;
        targetTitle = d.title;
        children = tasks.filter(t => t.deliverableId === id);
      }

      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTitle,
          children,
          level: type,
          apiKey: geminiApiKey,
        }),
      });

      const data = await res.json();
      if (data.summary) {
        if (type === 'phase') {
          await dbService.updatePhaseSummary(id, data.summary, storageMode);
        } else {
          await dbService.updateDeliverableSummary(id, data.summary, storageMode);
        }
        loadData();
      } else {
        alert("要約に失敗しました: " + (data.error || ""));
      }
    } catch (e: any) {
      alert("通信エラー: " + e.message);
    } finally {
      setSummarizing(false);
    }
  };

  if (!isMounted) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* Left Sidebar: Tree View */}
      <div className="w-1/3 min-w-[300px] border-r border-slate-200 bg-white flex flex-col h-full">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h1 className="font-bold text-lg text-slate-700">Project Tree</h1>
          <div className="flex gap-2">
             <button onClick={() => setStorageMode(storageMode === 'mock' ? 'supabase' : 'mock')}
                className="text-xs px-2 py-1 bg-slate-200 rounded hover:bg-slate-300 transition"
                title="Storage Mode"
             >
                {storageMode === 'mock' ? 'Mock (Local)' : 'Supabase'}
             </button>
             <button onClick={() => setShowSettings(true)} className="p-1 hover:bg-slate-200 rounded">
              <Settings size={18} />
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && <p className="text-sm text-slate-500">Loading...</p>}
          {!loading && projects.length === 0 && (
             <div className="text-center text-slate-400 py-8 text-sm">
               プロジェクトがありません
             </div>
          )}
          {projects.map(proj => (
            <div key={proj.id} className="space-y-1">
              {/* Project Node */}
              <div
                className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedNode?.id === proj.id ? 'bg-blue-100' : 'hover:bg-slate-100'}`}
                onClick={() => setSelectedNode({type: 'project', id: proj.id})}
              >
                <FolderOpen size={18} className="text-blue-500" />
                <span className="font-semibold text-sm flex-1">{proj.title}</span>
              </div>

              {/* Phases */}
              <div className="pl-6 space-y-1">
                {phases.filter(p => p.projectId === proj.id).map(phase => (
                  <div key={phase.id}>
                    <div
                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer ${selectedNode?.id === phase.id ? 'bg-indigo-100' : 'hover:bg-slate-100'}`}
                      onClick={() => setSelectedNode({type: 'phase', id: phase.id})}
                    >
                      <Folder size={16} className="text-indigo-400" />
                      <span className="text-sm flex-1">{phase.title}</span>
                    </div>

                    {/* Deliverables */}
                    <div className="pl-6 space-y-1">
                      {deliverables.filter(d => d.phaseId === phase.id).map(deliv => (
                        <div key={deliv.id}>
                          <div
                            className={`flex items-center gap-2 p-1 rounded cursor-pointer ${selectedNode?.id === deliv.id ? 'bg-emerald-100' : 'hover:bg-slate-100'}`}
                            onClick={() => setSelectedNode({type: 'deliverable', id: deliv.id})}
                          >
                            <FileText size={14} className="text-emerald-500" />
                            <span className="text-sm flex-1">{deliv.title}</span>
                          </div>

                          {/* Tasks */}
                          <div className="pl-6 space-y-0.5 mt-0.5">
                            {tasks.filter(t => t.deliverableId === deliv.id).map(task => (
                              <div
                                key={task.id}
                                className={`flex items-center gap-2 p-1 rounded cursor-pointer ${selectedNode?.id === task.id ? 'bg-orange-100' : 'hover:bg-slate-100'}`}
                                onClick={() => setSelectedNode({type: 'task', id: task.id})}
                              >
                                <CheckSquare size={12} className={task.status === 'done' ? 'text-green-500' : 'text-slate-400'} />
                                <span className={`text-xs ${task.status === 'done' ? 'line-through text-slate-400' : ''}`}>{task.title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {isCreator && (
            <button
              onClick={handleAddProject}
              className="mt-4 w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded hover:bg-slate-50 text-sm flex items-center justify-center gap-2"
            >
              <Plus size={16} /> プロジェクト追加
            </button>
          )}
        </div>
      </div>

      {/* Right Content: Detail View */}
      <div className="flex-1 bg-slate-50 h-full overflow-y-auto p-8">
        {selectedNode ? (
          <DetailPane
            node={selectedNode}
            isCreator={isCreator}
            projects={projects}
            phases={phases}
            deliverables={deliverables}
            tasks={tasks}
            onAddPhase={handleAddPhase}
            onAddDeliverable={handleAddDeliverable}
            onAddTask={handleAddTask}
            onDelete={handleDelete}
            onGenerateSummary={generateSummary}
            summarizing={summarizing}
            geminiApiKey={geminiApiKey}
            storageMode={storageMode}
            onDataChange={loadData}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
             <FolderOpen size={48} className="opacity-20" />
             <p>左側のツリーから項目を選択してください</p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Settings size={20}/> 設定</h2>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded border">
                <h3 className="font-semibold text-sm mb-2">クリエイターモード</h3>
                {isCreator ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-600 font-bold flex items-center gap-1"><Unlock size={16}/> 解除済み</span>
                    <button onClick={lockCreator} className="text-xs px-3 py-1 bg-slate-200 rounded">ロックする</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={passcodeInput} onChange={e => setPasscodeInput(e.target.value)}
                      placeholder="パスコード"
                      className="flex-1 border rounded px-2 text-sm"
                    />
                    <button
                      onClick={() => {
                        if(unlockCreator(passcodeInput)) {
                           alert('ロック解除しました');
                           setPasscodeInput('');
                        } else {
                           alert('パスコードが違います');
                        }
                      }}
                      className="px-3 py-1 bg-slate-800 text-white rounded text-sm flex items-center gap-1"
                    ><Lock size={14}/> 解除</button>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded border">
                <h3 className="font-semibold text-sm mb-2">Gemini API Key</h3>
                <input
                  type="password"
                  value={geminiKeyInput} onChange={e => setGeminiKeyInput(e.target.value)}
                  placeholder="AI要約用キー"
                  className="w-full border rounded px-2 py-1 mb-2 text-sm"
                />
                <button
                  onClick={() => { saveGeminiApiKey(geminiKeyInput); alert('保存しました'); }}
                  className="w-full py-1 bg-blue-600 text-white rounded text-sm"
                >保存</button>
              </div>

              <div className="p-4 bg-slate-50 rounded border">
                <h3 className="font-semibold text-sm mb-2">Supabase 接続設定</h3>
                <input
                  type="text"
                  value={supabaseUrlInput} onChange={e => setSupabaseUrlInput(e.target.value)}
                  placeholder="URL (https://...)"
                  className="w-full border rounded px-2 py-1 mb-2 text-sm"
                />
                <input
                  type="password"
                  value={supabaseKeyInput} onChange={e => setSupabaseKeyInput(e.target.value)}
                  placeholder="Anon Key"
                  className="w-full border rounded px-2 py-1 mb-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { saveSupabaseConfig(supabaseUrlInput, supabaseKeyInput); alert('保存しました'); }}
                    className="flex-1 py-1 bg-emerald-600 text-white rounded text-sm"
                  >保存</button>
                  <button
                    onClick={() => { clearSupabaseConfig(); setSupabaseUrlInput(''); setSupabaseKeyInput(''); }}
                    className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm"
                  >クリア</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPane({
  node, isCreator, projects, phases, deliverables, tasks,
  onAddPhase, onAddDeliverable, onAddTask, onDelete, onGenerateSummary, summarizing, geminiApiKey, storageMode, onDataChange
}: any) {

  if (node.type === 'project') {
    const p = projects.find((x:any) => x.id === node.id);
    if(!p) return <div>Not found</div>;
    return (
      <div className="max-w-3xl">
         <div className="flex items-center gap-3 mb-6">
            <FolderOpen className="text-blue-500" size={32} />
            <h1 className="text-3xl font-bold">{p.title}</h1>
            {isCreator && <button onClick={() => onDelete('project', p.id)} className="ml-auto text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>}
         </div>
         <p className="text-slate-500 text-sm mb-8">Level 1: Project</p>

         {isCreator && (
            <button onClick={() => onAddPhase(p.id)} className="px-4 py-2 bg-indigo-600 text-white rounded flex items-center gap-2 hover:bg-indigo-700">
               <Plus size={18} /> 新しいフェーズ（大項目）を追加
            </button>
         )}
      </div>
    );
  }

  if (node.type === 'phase') {
    const p = phases.find((x:any) => x.id === node.id);
    if(!p) return <div>Not found</div>;
    return (
      <div className="max-w-3xl">
         <div className="flex items-center gap-3 mb-6">
            <Folder className="text-indigo-400" size={32} />
            <h1 className="text-3xl font-bold">{p.title}</h1>
            {isCreator && <button onClick={() => onDelete('phase', p.id)} className="ml-auto text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>}
         </div>
         <p className="text-slate-500 text-sm mb-8">Level 2: Phase / Major Deliverable</p>

         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles size={18} className="text-amber-500"/> AI要約 (現在の状況)</h2>
               {isCreator && (
                  <button
                     onClick={() => {
                        if(!geminiApiKey) { alert('設定からGemini API Keyを登録してください'); return; }
                        onGenerateSummary('phase', p.id);
                     }}
                     disabled={summarizing}
                     className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded text-sm font-semibold hover:bg-amber-200 flex items-center gap-1 disabled:opacity-50"
                  >
                     {summarizing ? <Loader2 size={14} className="animate-spin" /> : "要約を生成"}
                  </button>
               )}
            </div>
            {p.summary ? (
               <div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap">{p.summary}</div>
            ) : (
               <p className="text-slate-400 text-sm">要約はまだ生成されていません。</p>
            )}
         </div>

         {isCreator && (
            <button onClick={() => onAddDeliverable(p.id)} className="px-4 py-2 bg-emerald-600 text-white rounded flex items-center gap-2 hover:bg-emerald-700">
               <Plus size={18} /> 新しい成果物（中項目）を追加
            </button>
         )}
      </div>
    );
  }

  if (node.type === 'deliverable') {
    const d = deliverables.find((x:any) => x.id === node.id);
    if(!d) return <div>Not found</div>;
    return (
      <div className="max-w-3xl">
         <div className="flex items-center gap-3 mb-6">
            <FileText className="text-emerald-500" size={32} />
            <h1 className="text-3xl font-bold">{d.title}</h1>
            {isCreator && <button onClick={() => onDelete('deliverable', d.id)} className="ml-auto text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>}
         </div>
         <p className="text-slate-500 text-sm mb-8">Level 3: Deliverable / Mid-level item</p>

         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles size={18} className="text-amber-500"/> AI要約 (進捗と課題)</h2>
               {isCreator && (
                  <button
                     onClick={() => {
                        if(!geminiApiKey) { alert('設定からGemini API Keyを登録してください'); return; }
                        onGenerateSummary('deliverable', d.id);
                     }}
                     disabled={summarizing}
                     className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded text-sm font-semibold hover:bg-amber-200 flex items-center gap-1 disabled:opacity-50"
                  >
                     {summarizing ? <Loader2 size={14} className="animate-spin" /> : "要約を生成"}
                  </button>
               )}
            </div>
            {d.summary ? (
               <div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap">{d.summary}</div>
            ) : (
               <p className="text-slate-400 text-sm">要約はまだ生成されていません。</p>
            )}
         </div>

         {isCreator && (
            <button onClick={() => onAddTask(d.id)} className="px-4 py-2 bg-orange-500 text-white rounded flex items-center gap-2 hover:bg-orange-600">
               <Plus size={18} /> 新しい進捗・タスク（小項目）を追加
            </button>
         )}
      </div>
    );
  }

  if (node.type === 'task') {
    const t = tasks.find((x:any) => x.id === node.id);
    if(!t) return <div>Not found</div>;

    const toggleStatus = async () => {
      if(!isCreator) return;
      const next = t.status === 'done' ? 'todo' : 'done';
      await dbService.updateTaskStatus(t.id, next, storageMode);
      onDataChange();
    };

    return (
      <div className="max-w-3xl">
         <div className="flex items-start gap-3 mb-6">
            <button onClick={toggleStatus} className={`mt-1 ${isCreator?'cursor-pointer':'cursor-default'}`}>
               <CheckSquare className={t.status === 'done' ? "text-green-500" : "text-slate-300"} size={32} />
            </button>
            <div>
               <h1 className={`text-3xl font-bold ${t.status === 'done' ? 'line-through text-slate-400' : ''}`}>{t.title}</h1>
               <p className="text-slate-500 text-sm mt-2">Level 4: Task / Progress item</p>
            </div>
            {isCreator && <button onClick={() => onDelete('task', t.id)} className="ml-auto text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>}
         </div>

         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[200px]">
            <h2 className="text-sm font-bold text-slate-500 mb-4">詳細内容</h2>
            {t.content ? (
               <div className="whitespace-pre-wrap">{t.content}</div>
            ) : (
               <p className="text-slate-400 italic">詳細は記述されていません。</p>
            )}
         </div>
      </div>
    );
  }

  return <div>Unknown Node Type</div>;
}
