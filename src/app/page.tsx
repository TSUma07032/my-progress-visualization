/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { dbService } from "../lib/dbService";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Project, ProjectNode, ProgressLog } from "../lib/types";
import ProjectMap from "../components/ProjectMap";
import {
  Sparkles,
  Lock,
  Unlock,
  Settings,
  FolderPlus,
  PlusCircle,
  FileText,
  Trash2,
  Edit3,
  Loader2,
  AlertTriangle,
  X,
  Plus,
  Printer,
  RefreshCw,
} from "lucide-react";

export default function Home() {
  const {
    isCreator,
    geminiApiKey,
    storageMode,
    isMounted,
    setStorageMode,
    unlockCreator,
    lockCreator,
    saveGeminiApiKey,
  } = useApp();

  // Core Data States
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [nodes, setNodes] = useState<ProjectNode[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);

  // Tab State: "add" (進捗追加), "tree" (進捗ツリー閲覧), "report" (今週の進捗報告資料)
  const [activeTab, setActiveTab] = useState<"add" | "tree" | "report">("tree");

  // Selected Node for Tree Detail view
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Raw Memo Input for Tab 1 (進捗追加)
  const [rawMemo, setRawMemo] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Split AI Proposed Results for Tab 1
  const [analyzedItems, setAnalyzedItems] = useState<any[]>([]);
  const [isResultSimulated, setIsResultSimulated] = useState(false);

  // Checkboxes for Collective AI Summarizing in Tab 2
  const [checkedLogIds, setCheckedLogIds] = useState<Set<string>>(new Set());
  const [isCollectiveSummarizing, setIsCollectiveSummarizing] = useState(false);
  const [collectiveSummaryResult, setCollectiveSummaryResult] = useState<{
    situation: string;
    task: string;
    action: string;
    result: string;
    question: string;
    nextTodo: string;
  } | null>(null);

  // Modals & Inputs
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");

  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [newNodeLabelInput, setNewNodeLabelInput] = useState("");
  const [newNodeParentIdInput, setNewNodeParentIdInput] = useState<string | null>(null);

  // Edit forms
  const [nodeRenameInput, setNodeRenameInput] = useState("");
  const [nodeNewParentId, setNodeNewParentId] = useState<string>("null");

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editSituation, setEditSituation] = useState("");
  const [editTask, setEditTask] = useState("");
  const [editAction, setEditAction] = useState("");
  const [editResult, setEditResult] = useState("");
  const [editQuestion, setEditQuestion] = useState("");
  const [editNextTodo, setEditNextTodo] = useState("");

  // System Loading / Toast
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper to trigger brief toast notifications
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. DATA SYNCHRONIZATION
  const loadProjects = async () => {
    setIsLoadingData(true);
    try {
      const list = await dbService.getProjects();
      setProjects(list);
      if (list.length > 0) {
        // Find if a project was already selected, or default to the first
        const prevId = selectedProject?.id;
        const exists = list.find((p) => p.id === prevId);
        if (exists) {
          setSelectedProject(exists);
        } else {
          setSelectedProject(list[0]);
        }
      } else {
        setSelectedProject(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadProjectDetails = async (projId: string) => {
    try {
      const fetchedNodes = await dbService.getNodes(projId);
      const fetchedLogs = await dbService.getLogs(projId);
      setNodes(fetchedNodes);
      setLogs(fetchedLogs);

      // Select root node as default, or preserve selection if valid
      if (fetchedNodes.length > 0) {
        const root = fetchedNodes.find((n) => n.parentId === null) || fetchedNodes[0];
        setSelectedNodeId((prevId) => {
          const stillExists = fetchedNodes.some((n) => n.id === prevId);
          return stillExists ? prevId : root.id;
        });
      } else {
        setSelectedNodeId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger reload of projects list when storagePreference or mount status changes
  useEffect(() => {
    if (isMounted) {
      loadProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, storageMode]);

  // Trigger loading project elements when project selection changes
  useEffect(() => {
    if (selectedProject) {
      loadProjectDetails(selectedProject.id);
      setCheckedLogIds(new Set()); // Clear checkboxes
    } else {
      setNodes([]);
      setLogs([]);
      setSelectedNodeId(null);
      setCheckedLogIds(new Set());
    }
  }, [selectedProject]);

  // Synchronize renaming input field with selected node label
  useEffect(() => {
    if (selectedNodeId) {
      const activeNode = nodes.find((n) => n.id === selectedNodeId);
      if (activeNode) {
        setNodeRenameInput(activeNode.label);
        setNodeNewParentId(activeNode.parentId || "null");
      }
    } else {
      setNodeRenameInput("");
      setNodeNewParentId("null");
    }
    setCheckedLogIds(new Set()); // Clear checked log checkboxes on node switch
  }, [selectedNodeId, nodes]);

  // Compute set of node IDs containing unreported logs (talked === false)
  const unspokenNodeIds = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      if (log.talked === false || log.talked === undefined) {
        set.add(log.nodeId);
      }
    });
    return set;
  }, [logs]);

  // Filter logs for selected node in Tab 2
  const selectedNodeLogs = useMemo(() => {
    if (!selectedNodeId) return [];
    return logs.filter((log) => log.nodeId === selectedNodeId);
  }, [logs, selectedNodeId]);

  // Get potential parent nodes (preventing circular hierarchy)
  const potentialParents = useMemo(() => {
    if (!selectedNodeId) return [];

    // Helper to recursively get all children / descendants of a node ID
    const getDescendants = (nodeId: string): Set<string> => {
      const set = new Set<string>();
      const recurse = (id: string) => {
        nodes.forEach((n) => {
          if (n.parentId === id) {
            set.add(n.id);
            recurse(n.id);
          }
        });
      };
      recurse(nodeId);
      return set;
    };

    const descendants = getDescendants(selectedNodeId);
    return nodes.filter(
      (n) => n.id !== selectedNodeId && !descendants.has(n.id)
    );
  }, [nodes, selectedNodeId]);

  // 2. PROJECT OPERATIONS
  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    try {
      const proj = await dbService.createProject(newProjectTitle.trim());
      setNewProjectTitle("");
      setShowAddProjectModal(false);
      showToast(`プロジェクト「${proj.title}」を作成しました。`);

      // Reload projects list and force select the new one
      const list = await dbService.getProjects();
      setProjects(list);
      const created = list.find((p) => p.id === proj.id);
      if (created) {
        setSelectedProject(created);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 3. NODE OPERATIONS
  const handleAddChildNode = (parentId: string) => {
    setNewNodeParentIdInput(parentId);
    setNewNodeLabelInput("");
    setShowAddNodeModal(true);
  };

  const handleAddNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newNodeLabelInput.trim()) return;

    try {
      const node = await dbService.createNode(
        selectedProject.id,
        newNodeLabelInput.trim(),
        newNodeParentIdInput
      );
      showToast(`ノード「${node.label}」をマップに追加しました。`);
      setShowAddNodeModal(false);
      await loadProjectDetails(selectedProject.id);
      setSelectedNodeId(node.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!selectedProject) return;
    try {
      // Reparent children to the parent of this deleted node to prevent losing branches, or delete them
      const targetNode = nodes.find((n) => n.id === nodeId);
      const parentId = targetNode ? targetNode.parentId : null;

      // Update immediate child nodes
      const children = nodes.filter((n) => n.parentId === nodeId);
      for (const child of children) {
        await dbService.updateNode(selectedProject.id, child.id, { parentId });
      }

      // Delete the node
      await dbService.deleteNode(selectedProject.id, nodeId);

      // Re-map logs belonging to this node to "node-root" or nearest parent
      const rootNode = nodes.find((n) => n.parentId === null) || nodes[0];
      const fallbackNodeId = rootNode ? rootNode.id : "node-root";
      const affectedLogs = logs.filter((log) => log.nodeId === nodeId);

      for (const log of affectedLogs) {
        await dbService.updateLog(selectedProject.id, log.id, { nodeId: fallbackNodeId });
      }

      showToast("ノードを削除し、配下の子ノードと進捗ログを再配置しました。");
      await loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedNodeId || !nodeRenameInput.trim()) return;

    try {
      await dbService.updateNode(selectedProject.id, selectedNodeId, {
        label: nodeRenameInput.trim(),
      });
      showToast("ノード名を変更しました。");
      await loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReparentNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedNodeId) return;

    const newParent = nodeNewParentId === "null" ? null : nodeNewParentId;
    try {
      await dbService.updateNode(selectedProject.id, selectedNodeId, {
        parentId: newParent,
      });
      showToast("ノードの親子関係（マッピング構造）を変更しました。");
      await loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error(err);
    }
  };

  // 4. LOG & STATUS OPERATIONS
  const handleToggleTalked = async (log: ProgressLog) => {
    if (!selectedProject) return;
    const nextStatus = !log.talked;
    try {
      await dbService.updateLog(selectedProject.id, log.id, { talked: nextStatus });
      setLogs((prev) =>
        prev.map((l) => (l.id === log.id ? { ...l, talked: nextStatus } : l))
      );
      showToast(
        nextStatus
          ? "「話済み（報告済み）」に設定しました。"
          : "「まだ話していない（未報告）」に設定しました。"
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogDelete = async (logId: string) => {
    if (!selectedProject) return;
    if (confirm("この進捗ログを削除しますか？この操作は取り消せません。")) {
      try {
        await dbService.deleteLog(selectedProject.id, logId);
        showToast("進捗ログを削除しました。");
        await loadProjectDetails(selectedProject.id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleLogEditStart = (log: ProgressLog) => {
    setEditingLogId(log.id);
    setEditSituation(log.situation);
    setEditTask(log.task);
    setEditAction(log.action);
    setEditResult(log.result);
    setEditQuestion(log.question || "");
    setEditNextTodo(log.nextTodo || "");
  };

  const handleLogEditSubmit = async (e: React.FormEvent, logId: string) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      await dbService.updateLog(selectedProject.id, logId, {
        situation: editSituation,
        task: editTask,
        action: editAction,
        result: editResult,
        question: editQuestion,
        nextTodo: editNextTodo,
      });
      setEditingLogId(null);
      showToast("進捗ログの内容を更新しました。");
      await loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error(err);
    }
  };

  // 5. TAB 1: AI SPLIT MEMO ANALYZER
  const handleAIAnalyze = async () => {
    if (!rawMemo.trim() || !selectedProject) return;

    setIsAnalyzing(true);
    setApiError(null);
    setAnalyzedItems([]);

    const simpleNodes = nodes.map((n) => ({
      id: n.id,
      label: n.label,
      parentId: n.parentId,
    }));

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawMemo,
          nodes: simpleNodes,
          apiKey: geminiApiKey,
          useSimulation: !geminiApiKey,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || errData.error || "AI解析中にエラーが発生しました。");
      }

      const data = await response.json();

      // We expect an array under the 'items' key
      if (data.items && Array.isArray(data.items)) {
        // Hydrate default values for mapping
        const hydrated = data.items.map((item: any, idx: number) => {
          const defaultNodeId = item.nodeId && nodes.some((n) => n.id === item.nodeId) ? item.nodeId : "";
          const mappingType = defaultNodeId ? "existing" : "new";
          return {
            id: `temp-item-${idx}-${Date.now()}`,
            situation: item.situation || "",
            task: item.task || "",
            action: item.action || "",
            result: item.result || "",
            question: item.question || "",
            nextTodo: item.nextTodo || "",
            mappingType, // "existing" or "new"
            nodeId: defaultNodeId || (nodes.length > 0 ? nodes[0].id : ""),
            newNodeLabel: item.newNodeLabel || `展開：新進捗テーマ-${idx + 1}`,
            newNodeParentId: item.newNodeParentId && nodes.some((n) => n.id === item.newNodeParentId)
              ? item.newNodeParentId
              : (nodes.length > 0 ? nodes[0].id : "node-root"),
          };
        });
        setAnalyzedItems(hydrated);
        setIsResultSimulated(!!data.isSimulated);
        showToast(
          data.isSimulated
            ? "AIシミュレーションによる分割解析が完了しました。"
            : `Geminiがメモを ${hydrated.length} つのトピックに分割・構造化しました！`
        );
      } else {
        throw new Error("APIレスポンスの構造に互換性がありません。");
      }
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "接続エラーが発生しました。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Register multiple split items into the DB
  const handleSaveAllAnalyzedItems = async () => {
    if (!selectedProject || analyzedItems.length === 0) return;

    try {
      setIsAnalyzing(true);
      for (const item of analyzedItems) {
        let finalNodeId = item.nodeId;

        // Create new node if mapping type is "new"
        if (item.mappingType === "new" && item.newNodeLabel.trim()) {
          const parentId = item.newNodeParentId === "node-root" || !item.newNodeParentId ? null : item.newNodeParentId;
          const createdNode = await dbService.createNode(
            selectedProject.id,
            item.newNodeLabel.trim(),
            parentId
          );
          finalNodeId = createdNode.id;
        }

        // Save progress log
        await dbService.createLog(
          selectedProject.id,
          finalNodeId || (nodes.length > 0 ? nodes[0].id : "node-root"),
          rawMemo,
          item.situation,
          item.task,
          item.action,
          item.result,
          item.question,
          item.nextTodo,
          undefined,
          undefined,
          false // default: unmarked as talked (unreported)
        );
      }

      showToast(`${analyzedItems.length} 件の進捗ログをツリーマップにマッピング・登録しました！`);
      setAnalyzedItems([]);
      setRawMemo("");
      await loadProjectDetails(selectedProject.id);

      // Automatically switch to Tree view so they can see their new nodes/logs!
      setActiveTab("tree");
    } catch (err) {
      console.error(err);
      alert("保存中にエラーが発生しました。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateAnalyzedItemField = (itemId: string, field: string, value: any) => {
    setAnalyzedItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteAnalyzedItem = (itemId: string) => {
    setAnalyzedItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  // 6. MULTI-SELECT COLLECTIVE SUMMARIZATION (TAB 2)
  const handleToggleSelectLog = (logId: string) => {
    setCheckedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const handleCollectiveSummarySubmit = async () => {
    if (!selectedProject || checkedLogIds.size < 2) return;

    setIsCollectiveSummarizing(true);
    setCollectiveSummaryResult(null);

    const logsToSummarize = logs.filter((l) => checkedLogIds.has(l.id));
    const combinedMemos = logsToSummarize
      .map((l, idx) => `[進捗ログ ${idx + 1}]\n状況：${l.situation}\n課題：${l.task}\n行動：${l.action}\n結果：${l.result}\n相談：${l.question}\n次：${l.nextTodo}`)
      .join("\n\n---\n\n");

    try {
      if (!geminiApiKey) {
        // Fallback simulation for merging summaries
        setTimeout(() => {
          const combinedConclusion = `【一括要約】選ばれた ${logsToSummarize.length} 件の進捗の成果を統合：\n` + logsToSummarize.map(l => l.result).join(" / ");
          const combinedStruggle = `選ばれた進捗に共通するエラー・課題：\n` + logsToSummarize.map(l => l.action).join("\n");
          const combinedDiscussion = `統括的な議論テーマの提案：\n` + logsToSummarize.map(l => l.question).join("\n");
          setCollectiveSummaryResult({
            situation: "一括要約",
            task: "複数タスクの統合",
            action: combinedStruggle,
            result: combinedConclusion,
            question: combinedDiscussion,
            nextTodo: "次フェーズへ移行"
          });
          setIsCollectiveSummarizing(false);
        }, 1200);
        return;
      }

      // Real Gemini API merger
      const prompt = `
あなたはプロジェクトの進行をまとめる統括者です。
ユーザーが選択した複数の進捗ログがあります。これらを重複をなくし、かつ葛藤や相談すべきテーマなどの「綺麗に丸めない試行錯誤」のディテールを損なうことなく、1つの代表的な要約にマージしてください。

マージ元の進捗一覧:
${combinedMemos}

必ず以下のJSONスキーマに従った単一のオブジェクトのみを出力してください。
JSONスキーマ:
{
  "conclusion": "成果や結論を1〜3行にまとめた文章",
  "struggle": "直面した悩み、葛藤、バグ、問題点の詳細をまとめた文章（省略せず綺麗にまとめすぎないようにしてください）",
  "discussion": "統括的に報告相手へ質問・相談すべき相談事項の提案"
}
`;

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        generationConfig: { responseMimeType: "application/json" },
      });

      const response = await model.generateContent(prompt);
      let text = response.response.text();
      text = text.replace(/```json/gi, '').replace(/```/gi, '').trim();

      const parsed = JSON.parse(text);
      setCollectiveSummaryResult({
        situation: parsed.situation || "",
        task: parsed.task || "",
        action: parsed.action || "",
        result: parsed.result || "要約の生成に失敗しました。",
        question: parsed.question || "",
        nextTodo: parsed.nextTodo || "",
      });
    } catch (err: any) {
      console.error(err);
      alert(`一括要約の生成に失敗しました: ${err.message || err}`);
    } finally {
      setIsCollectiveSummarizing(false);
    }
  };

  // 7. TAB 3: WEEKLY REPORT (UNREPORTED LOGS FILTER)
  const unreportedLogsByNode = useMemo(() => {
    const unrep = logs.filter((log) => log.talked === false || log.talked === undefined);

    // Group by node ID
    const grouped: Record<string, { nodeLabel: string; logs: ProgressLog[] }> = {};
    unrep.forEach((log) => {
      const node = nodes.find((n) => n.id === log.nodeId);
      const label = node ? node.label : "未分類の進捗";
      if (!grouped[log.nodeId]) {
        grouped[log.nodeId] = { nodeLabel: label, logs: [] };
      }
      grouped[log.nodeId].logs.push(log);
    });

    return Object.values(grouped);
  }, [logs, nodes]);

  // Handle saving credentials
  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    saveGeminiApiKey(apiKeyInput.trim());
    setShowKeyModal(false);
    showToast(
      apiKeyInput.trim()
        ? "Gemini APIキーをブラウザに保存しました。高精度なAI解析が利用可能です！"
        : "APIキーをクリアしました。AIシミュレーションモードが有効です。"
    );
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = unlockCreator(passcodeInput);
    if (success) {
      setShowPasscodeModal(false);
      setPasscodeError(false);
      showToast("管理者（資料作成者）モードを解除しました。進捗追加や編集が可能です。");
    } else {
      setPasscodeError(true);
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <span className="text-xs text-slate-500 font-semibold">システムをロード中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 relative">
      {/* 1. HEADER (NO-PRINT) */}
      <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-4 lg:px-8 py-3.5">
        <div className="max-w-[1500px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">

          {/* Logo & Project Picker */}
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-emerald-500 to-teal-600 text-white p-2 rounded-xl shadow-md">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-900 tracking-tight leading-none">
                  マップ型 思考ログ構築システム
                </h1>
                <span className="text-[10px] text-slate-400 font-medium">
                  Al-driven Progress Tracking & Struggle Capture
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden md:block" />

            {/* Project dropdown selector */}
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <span className="text-[11px] font-bold text-slate-400 shrink-0 hidden sm:inline">
                選択中のプロジェクト:
              </span>
              {projects.length > 0 ? (
                <select
                  value={selectedProject?.id || ""}
                  onChange={(e) => {
                    const found = projects.find((p) => p.id === e.target.value);
                    if (found) setSelectedProject(found);
                  }}
                  className="bg-slate-100 hover:bg-slate-200/80 border-none rounded-lg text-xs font-black text-slate-700 px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 cursor-pointer max-w-full"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-red-500 font-bold">プロジェクトがありません</span>
              )}

              {isCreator && (
                <button
                  onClick={() => {
                    setNewProjectTitle("");
                    setShowAddProjectModal(true);
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg p-1.5 transition"
                  title="新規プロジェクトを作成"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Configuration toolbar */}
          <div className="flex items-center gap-2 self-end md:self-auto">

            {/* Storage preferences switch */}
            <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border">
              <button
                onClick={() => setStorageMode("mock")}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-all duration-150 ${
                  storageMode === "mock"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                モックモード
              </button>
              <button
                onClick={() => setStorageMode("firebase")}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-all duration-150 ${
                  storageMode === "firebase"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Firebase
              </button>
            </div>

            {/* Gemini API key configuration */}
            <button
              onClick={() => {
                setApiKeyInput(geminiApiKey);
                setShowKeyModal(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                geminiApiKey
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 animate-pulse"
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-amber-500" />
              <span>{geminiApiKey ? "Gemini APIキー設定済" : "Gemini APIキーを設定"}</span>
            </button>

            {/* Role locking toggle */}
            {isCreator ? (
              <button
                onClick={lockCreator}
                className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
                title="編集をロック"
              >
                <Lock className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span className="hidden sm:inline">資料作成者（ログイン中）</span>
                <span className="sm:hidden">作成者</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setPasscodeInput("");
                  setShowPasscodeModal(true);
                }}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow"
              >
                <Unlock className="w-3.5 h-3.5 text-slate-300" />
                <span>資料作成者（ログイン）</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* 2. TAB SWITCH NAVIGATION (NO-PRINT) */}
      <div className="no-print bg-slate-100 border-b border-slate-200 py-2">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-8 flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("add")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === "add"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-transparent text-slate-500 hover:bg-slate-200/60"
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>① 進捗追加システム</span>
              {!isCreator && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
            </button>

            <button
              onClick={() => setActiveTab("tree")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === "tree"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-transparent text-slate-500 hover:bg-slate-200/60"
              }`}
            >
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
              <span>② 進捗ツリー閲覧システム</span>
            </button>

            <button
              onClick={() => setActiveTab("report")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === "report"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-transparent text-slate-500 hover:bg-slate-200/60"
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>③ 今週の進捗報告資料</span>
              {unreportedLogsByNode.length > 0 && (
                <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                  {unreportedLogsByNode.reduce((sum, item) => sum + item.logs.length, 0)}
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] font-bold text-slate-400">
            {storageMode === "firebase" ? "📡 Firebase同期接続中" : "💾 ブラウザのLocalStorageに保存中"}
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="max-w-[1500px] mx-auto px-4 lg:px-8 mt-6">
        {isLoadingData ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
            <span className="text-sm font-bold text-slate-500">データを同期中...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: 進捗追加システム (Restricted to creator) */}
            {activeTab === "add" && (
              <div className="no-print space-y-6">
                {!isCreator ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm space-y-6">
                    <div className="bg-rose-50 text-rose-600 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto shadow-inner">
                      <Lock className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-black text-slate-800 text-lg">資料作成者専用機能です</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        この画面は、今週の試行錯誤や結論メモをAIに整理させ、ツリーマップへ登録するための管理者（作成者）専用ページです。右上のボタンからログインしてご利用ください。
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setPasscodeInput("");
                        setShowPasscodeModal(true);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow transition"
                    >
                      ログイン画面を開く
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* Left side: Input area */}
                    <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <h2 className="font-black text-slate-800 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse" />
                          <span>今週の進捗メモ入力</span>
                        </h2>
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-black">
                          AI解析・複数ノード分割
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        日々の活動・試行錯誤メモ（進捗量が多いと**AIが自動的に複数ノードへ分割**してくれます）:
                      </p>

                      <textarea
                        value={rawMemo}
                        onChange={(e) => setRawMemo(e.target.value)}
                        placeholder={`【実験項目1：プロンプト性能評価】
今週はGeminiのJSON構造化出力プロンプトの調整を行った。スキーマが安定したが、極稀に想定外のハルシネーションが発生して苦戦した。

【実験項目2：状態トグルの実装】
進捗ツリー上で「話済み」か「未報告」かを切り替えられるようにチェックボックスと状態管理を実装した。また未報告のログがある箇所のマップ表示を変更して視認性を高めた。`}
                        className="w-full h-80 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-mono leading-relaxed"
                      />

                      {!geminiApiKey && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-bold text-[11px]">Gemini APIキーが設定されていません</p>
                            <p className="text-[10px] text-amber-700 leading-relaxed">
                              APIキーがないため、**AIシミュレーション機能（ローカル擬似解析）**が動作します。メモが長いか、行頭に bullet (-, *) が複数ある場合は自動で2つのトピックに分割提案を行います。
                            </p>
                          </div>
                        </div>
                      )}

                      {apiError && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs space-y-2">
                          <p className="font-bold flex items-center gap-1.5 text-[11px]">
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                            <span>解析に失敗しました</span>
                          </p>
                          <p className="text-[10px] text-rose-700 leading-relaxed">{apiError}</p>
                        </div>
                      )}

                      <button
                        onClick={handleAIAnalyze}
                        disabled={isAnalyzing || !rawMemo.trim()}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs py-3 rounded-xl shadow transition flex items-center justify-center gap-2"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>思考ログを切り分け中...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>{geminiApiKey ? "AI分析（分割対応）を実行" : "シミュレーション解析（分割対応）を実行"}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Right side: AI Results / Verification Panel */}
                    <div className="lg:col-span-7 space-y-4">
                      {analyzedItems.length > 0 ? (
                        <div className="space-y-4">
                          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                            <div className="space-y-0.5">
                              <h3 className="font-black text-emerald-900 text-sm flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                                <span>AIが {analyzedItems.length} つの進捗に切り分けました</span>
                              </h3>
                              {isResultSimulated && (
                                <span className="inline-block bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                                  AIシミュレーション実行中
                                </span>
                              )}
                              <p className="text-[10px] text-emerald-700 leading-normal">
                                ※それぞれのカードから個別に調整・マッピングして保存、または一括で保存できます。
                              </p>
                            </div>
                            <button
                              onClick={handleSaveAllAnalyzedItems}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl shadow-md transition whitespace-nowrap"
                            >
                              すべて一括で保存・登録
                            </button>
                          </div>

                          {/* Render proposed split cards */}
                          <div className="space-y-4">
                            {analyzedItems.map((item, index) => (
                              <div
                                key={item.id}
                                className="bg-white border-2 border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 relative"
                              >
                                <button
                                  onClick={() => handleDeleteAnalyzedItem(item.id)}
                                  className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition"
                                  title="この進捗を破棄"
                                >
                                  <X className="w-5 h-5" />
                                </button>

                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 bg-emerald-100 text-emerald-700 text-xs font-black rounded-full flex items-center justify-center">
                                    {index + 1}
                                  </span>
                                  <h4 className="font-black text-slate-800 text-xs">
                                    進捗トピック #{index + 1}
                                  </h4>
                                </div>

                                {/* Conclusion edit */}
                                <div className="space-y-1">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                                    結論・進捗要約:
                                  </label>
                                  <input
                                    type="text"
                                    value={item.conclusion}
                                    onChange={(e) =>
                                      handleUpdateAnalyzedItemField(item.id, "conclusion", e.target.value)
                                    }
                                    className="w-full border border-slate-100 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs text-slate-800 font-semibold"
                                  />
                                </div>

                                {/* Struggle edit */}
                                <div className="space-y-1">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                                    葛藤と試行錯誤プロセス:
                                  </label>
                                  <textarea
                                    value={item.struggle}
                                    onChange={(e) =>
                                      handleUpdateAnalyzedItemField(item.id, "struggle", e.target.value)
                                    }
                                    className="w-full border border-slate-100 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs text-slate-700 leading-relaxed"
                                    rows={2}
                                  />
                                </div>

                                {/* Discussion edit */}
                                <div className="space-y-1">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase">
                                    相談・議論のテーマ:
                                  </label>
                                  <input
                                    type="text"
                                    value={item.discussion}
                                    onChange={(e) =>
                                      handleUpdateAnalyzedItemField(item.id, "discussion", e.target.value)
                                    }
                                    className="w-full border border-slate-100 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs text-slate-600 font-semibold"
                                  />
                                </div>

                                {/* Mapping Selector */}
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-3 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-black text-slate-700">マッピング設定（紐付け先ノード）:</span>
                                    <div className="flex gap-2">
                                      <label className="flex items-center gap-1.5 font-bold text-[11px] cursor-pointer text-slate-600">
                                        <input
                                          type="radio"
                                          name={`mapping-type-${item.id}`}
                                          checked={item.mappingType === "new"}
                                          onChange={() =>
                                            handleUpdateAnalyzedItemField(item.id, "mappingType", "new")
                                          }
                                          className="text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>新規ノードを自動生成</span>
                                      </label>
                                      <label className="flex items-center gap-1.5 font-bold text-[11px] cursor-pointer text-slate-600">
                                        <input
                                          type="radio"
                                          name={`mapping-type-${item.id}`}
                                          checked={item.mappingType === "existing"}
                                          onChange={() =>
                                            handleUpdateAnalyzedItemField(item.id, "mappingType", "existing")
                                          }
                                          className="text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>既存ノードに紐付け</span>
                                      </label>
                                    </div>
                                  </div>

                                  {item.mappingType === "existing" ? (
                                    <select
                                      value={item.nodeId}
                                      onChange={(e) =>
                                        handleUpdateAnalyzedItemField(item.id, "nodeId", e.target.value)
                                      }
                                      className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 text-xs text-slate-700 font-semibold"
                                    >
                                      {nodes.map((n) => (
                                        <option key={n.id} value={n.id}>
                                          {n.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold text-slate-400">新規ノード名:</span>
                                        <input
                                          type="text"
                                          value={item.newNodeLabel}
                                          onChange={(e) =>
                                            handleUpdateAnalyzedItemField(item.id, "newNodeLabel", e.target.value)
                                          }
                                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-semibold"
                                        />
                                      </div>
                                      <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold text-slate-400">親ノードの指定:</span>
                                        <select
                                          value={item.newNodeParentId}
                                          onChange={(e) =>
                                            handleUpdateAnalyzedItemField(item.id, "newNodeParentId", e.target.value)
                                          }
                                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-semibold"
                                        >
                                          <option value="node-root">なし（Root直下）</option>
                                          {nodes.map((n) => (
                                            <option key={n.id} value={n.id}>
                                              {n.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex justify-end">
                                  <button
                                    onClick={async () => {
                                      // Save just this item
                                      try {
                                        setIsAnalyzing(true);
                                        let finalId = item.nodeId;
                                        if (item.mappingType === "new" && item.newNodeLabel.trim()) {
                                          const parent = item.newNodeParentId === "node-root" || !item.newNodeParentId ? null : item.newNodeParentId;
                                          const created = await dbService.createNode(
                                            selectedProject!.id,
                                            item.newNodeLabel.trim(),
                                            parent
                                          );
                                          finalId = created.id;
                                        }
                                        await dbService.createLog(
                                          selectedProject!.id,
                                          finalId || (nodes.length > 0 ? nodes[0].id : "node-root"),
                                          rawMemo,
                                          item.situation,
                                          item.task,
                                          item.action,
                                          item.result,
                                          item.question,
                                          item.nextTodo,
                                          undefined,
                                          undefined,
                                          false
                                        );
                                        showToast("進捗トピックをマップに登録しました！");
                                        handleDeleteAnalyzedItem(item.id);
                                        await loadProjectDetails(selectedProject!.id);
                                      } catch (err) {
                                        console.error(err);
                                      } finally {
                                        setIsAnalyzing(false);
                                      }
                                    }}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] px-3.5 py-1.5 rounded-lg transition"
                                  >
                                    このトピックのみをマップに登録
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400 font-bold space-y-2">
                          <p>AIによる分析結果はここに表示されます</p>
                          <p className="text-[11px] text-slate-400 font-semibold">
                            左側で今週の進捗メモを入力して、AI解析を実行してください。
                          </p>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* TAB 2: 進捗ツリー閲覧システム (Accessible to all) */}
            {activeTab === "tree" && (
              <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* Left side (60%): Hierarchy Map */}
                <div className="lg:col-span-7 xl:col-span-8 h-[550px] lg:h-[700px] w-full">
                  <ProjectMap
                    nodesList={nodes}
                    currentNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                    isCreator={isCreator}
                    onAddChildNode={handleAddChildNode}
                    onDeleteNode={handleDeleteNode}
                    unspokenNodeIds={unspokenNodeIds}
                  />
                </div>

                {/* Right side (40%): Node Details Panel */}
                <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 max-h-[700px] overflow-y-auto">
                  {selectedNodeId ? (
                    <>
                      {/* Node Header Info */}
                      <div className="border-b pb-4 space-y-2">
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded uppercase">
                          選択中のノード
                        </span>
                        <h2 className="text-base font-black text-slate-800 leading-tight">
                          {nodes.find((n) => n.id === selectedNodeId)?.label}
                        </h2>
                      </div>

                      {/* Creator Node Editing Controls */}
                      {isCreator && selectedNodeId !== "node-root" && (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-4">
                          <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>ノード管理設定（管理者）</span>
                          </h4>

                          {/* Rename form */}
                          <form onSubmit={handleRenameNodeSubmit} className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-400">
                              ノード名を変更:
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={nodeRenameInput}
                                onChange={(e) => setNodeRenameInput(e.target.value)}
                                className="flex-1 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-semibold"
                              />
                              <button
                                type="submit"
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition shrink-0"
                              >
                                変更
                              </button>
                            </div>
                          </form>

                          {/* Reparent form */}
                          <form onSubmit={handleReparentNodeSubmit} className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-400">
                              親ノードを変更（依存・親子関係の切り替え）:
                            </label>
                            <div className="flex gap-2">
                              <select
                                value={nodeNewParentId}
                                onChange={(e) => setNodeNewParentId(e.target.value)}
                                className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-semibold cursor-pointer"
                              >
                                <option value="null">なし（Root直下）</option>
                                {potentialParents.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                className="bg-slate-950 hover:bg-slate-800 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition shrink-0"
                              >
                                変更
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* Node Progress Logs Section */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span>紐づく進捗ログ一覧 ({selectedNodeLogs.length})</span>
                          </h3>

                          {/* Multi select summarizing trigger */}
                          {checkedLogIds.size >= 2 && (
                            <button
                              onClick={handleCollectiveSummarySubmit}
                              disabled={isCollectiveSummarizing}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-md transition flex items-center gap-1"
                            >
                              {isCollectiveSummarizing ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 text-amber-300" />
                              )}
                              <span>選んだ {checkedLogIds.size} 件をまとめて要約</span>
                            </button>
                          )}
                        </div>

                        {selectedNodeLogs.length > 0 ? (
                          <div className="space-y-3">
                            {selectedNodeLogs.map((log) => {
                              const isUnreported = log.talked === false || log.talked === undefined;
                              return (
                                <div
                                  key={log.id}
                                  className={`border rounded-xl p-4 space-y-3 transition-all duration-150 ${
                                    isUnreported
                                      ? "border-amber-300 bg-amber-50/20 shadow-sm"
                                      : "border-slate-100 bg-white"
                                  }`}
                                >
                                  {/* Log Top Controls Row */}
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <div className="flex items-center gap-2">
                                      {/* Checkbox for collective summary selection */}
                                      <input
                                        type="checkbox"
                                        checked={checkedLogIds.has(log.id)}
                                        onChange={() => handleToggleSelectLog(log.id)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                                        title="一括要約の対象に含める"
                                      />
                                      <span className="text-[10px] text-slate-400 font-bold">
                                        {new Date(log.createdAt).toLocaleDateString("ja-JP")}
                                      </span>
                                    </div>

                                    {/* Talked vs Unreported Toggling Controls */}
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleToggleTalked(log)}
                                        className={`text-[9px] font-black px-2 py-0.5 rounded transition ${
                                          isUnreported
                                            ? "bg-amber-100 hover:bg-amber-200 text-amber-800"
                                            : "bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                                        }`}
                                        title="話済み・未報告ステータスを切り替え"
                                      >
                                        {isUnreported ? "未報告（切り替え）" : "報告済（切り替え）"}
                                      </button>

                                      {/* Creator controls for edit/delete */}
                                      {isCreator && (
                                        <div className="flex items-center gap-1 border-l pl-2">
                                          <button
                                            onClick={() => handleLogEditStart(log)}
                                            className="text-slate-400 hover:text-indigo-600 transition"
                                            title="進捗を編集"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleLogDelete(log.id)}
                                            className="text-slate-400 hover:text-rose-600 transition"
                                            title="進捗を削除"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Inline Log Editor */}
                                  {editingLogId === log.id ? (
                                    <form
                                      onSubmit={(e) => handleLogEditSubmit(e, log.id)}
                                      className="space-y-3"
                                    >
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400">Situation (状況):</label>
                                        <input type="text" value={editSituation} onChange={(e) => setEditSituation(e.target.value)} className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800" />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400">Task (課題):</label>
                                        <input type="text" value={editTask} onChange={(e) => setEditTask(e.target.value)} className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800 font-semibold" />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400">Action (行動):</label>
                                        <textarea value={editAction} onChange={(e) => setEditAction(e.target.value)} className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-700 min-h-[60px]" />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400">Result (結果):</label>
                                        <input type="text" value={editResult} onChange={(e) => setEditResult(e.target.value)} className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800 font-semibold" />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400">Question (相談):</label>
                                        <input type="text" value={editQuestion} onChange={(e) => setEditQuestion(e.target.value)} className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-700" />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400">Next Todo (次):</label>
                                        <input type="text" value={editNextTodo} onChange={(e) => setEditNextTodo(e.target.value)} className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-700" />
                                      </div>
                                      <div className="flex gap-1.5 justify-end">
                                        <button
                                          type="button"
                                          onClick={() => setEditingLogId(null)}
                                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-2.5 py-1 rounded"
                                        >
                                          キャンセル
                                        </button>
                                        <button
                                          type="submit"
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded"
                                        >
                                          保存
                                        </button>
                                      </div>
                                    </form>
                                  ) : (
                                    <div className="space-y-2 text-xs leading-relaxed">
                                                                            <div className="space-y-0.5"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Situation (状況)</span><p className="text-slate-700">{log.situation}</p></div>
                                      <div className="space-y-0.5"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Task (課題)</span><p className="font-bold text-slate-800">{log.task}</p></div>
                                      <div className="space-y-0.5"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Action (行動)</span><p className="text-slate-600 whitespace-pre-wrap">{log.action}</p></div>
                                      <div className="space-y-0.5"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Result (結果)</span><p className="font-bold text-slate-800">{log.result}</p></div>
                                      {log.question && <div className="space-y-0.5"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Question (相談)</span><p className="font-semibold text-slate-700 italic">❓ {log.question}</p></div>}
                                      {log.nextTodo && <div className="space-y-0.5"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Next (次)</span><p className="text-slate-700">{log.nextTodo}</p></div>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-center py-12 text-slate-400 text-xs font-semibold">
                            このノードに紐づく進捗ログはありません。
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-24 text-slate-400 font-bold space-y-1 text-xs">
                      <p>マップ上のノードを選択してください</p>
                      <p className="text-slate-400 font-normal">
                        詳細な進捗ログや相談事項がここに表示されます。
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 3: 今週の進捗報告資料 (A4 print layout preview) */}
            {activeTab === "report" && (
              <div className="space-y-6">

                {/* Screen-only Preview Header block */}
                <div className="no-print bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="font-black text-slate-800 flex items-center gap-2">
                      <Printer className="w-5 h-5 text-indigo-600" />
                      <span>今週の進捗報告資料プレビュー</span>
                    </h2>
                    <p className="text-xs text-slate-500 leading-normal">
                      マップ上の進捗ログのうち、**まだ話していない（未報告）**状態のものだけを自動抽出してA4報告書フォーマットで表示しています。
                    </p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    disabled={unreportedLogsByNode.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-2 self-start md:self-auto"
                  >
                    <Printer className="w-4 h-4" />
                    <span>資料をPDF出力・印刷する (A4用紙最適化)</span>
                  </button>
                </div>

                {/* Print Content Area (Styled for A4 paper) */}
                {unreportedLogsByNode.length > 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm max-w-[900px] mx-auto space-y-8 font-serif leading-relaxed">

                    {/* Header line */}
                    <div className="border-b-4 border-slate-900 pb-4 flex justify-between items-end">
                      <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-950">
                          週次進捗報告：思考ログ資料
                        </h1>
                        <span className="text-xs text-slate-600 font-bold mt-1 block">
                          プロジェクト名: {selectedProject?.title}
                        </span>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <span>報告作成日: {new Date().toLocaleDateString("ja-JP")}</span>
                      </div>
                    </div>

                    {/* Grouped contents */}
                    <div className="space-y-8">
                      {unreportedLogsByNode.map((group, index) => (
                        <div key={group.nodeLabel + index} className="space-y-4">
                          <h3 className="text-sm font-black text-indigo-950 bg-indigo-50/50 border-l-4 border-indigo-600 px-3 py-1.5 rounded-r">
                            【マップ上の対象領域：{group.nodeLabel}】
                          </h3>

                          <div className="space-y-6 pl-2">
                            {group.logs.map((log, logIdx) => (
                              <div
                                key={log.id}
                                className="border-b border-dashed border-slate-200 pb-4 last:border-none last:pb-0 space-y-3 text-xs"
                              >
                                {/* Mini header inside group */}
                                <div className="text-[10px] text-slate-400 font-black flex items-center justify-between">
                                  <span>進捗ログ #{logIdx + 1}</span>
                                  <span>記録日: {new Date(log.createdAt).toLocaleDateString("ja-JP")}</span>
                                </div>

                                {/* 1. Conclusion */}
                                                                <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug flex items-center gap-1"><span className="text-blue-600">■</span><span>Situation (状況)</span></h4><p className="text-slate-700 pl-4">{log.situation}</p></div>
                                <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug flex items-center gap-1"><span className="text-purple-600">■</span><span>Task (課題)</span></h4><p className="text-slate-800 font-semibold pl-4">{log.task}</p></div>
                                <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug flex items-center gap-1"><span className="text-amber-600">■</span><span>Action (行動)</span></h4><p className="text-slate-700 pl-4 leading-relaxed whitespace-pre-wrap">{log.action}</p></div>
                                <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug flex items-center gap-1"><span className="text-emerald-600">■</span><span>Result (結果)</span></h4><p className="text-slate-800 font-semibold pl-4">{log.result}</p></div>
                                {log.question && <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug flex items-center gap-1"><span className="text-indigo-600">■</span><span>Question (相談)</span></h4><p className="text-indigo-900 font-bold italic pl-4">❓ {log.question}</p></div>}
                                {log.nextTodo && <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug flex items-center gap-1"><span className="text-orange-600">■</span><span>Next (次)</span></h4><p className="text-slate-700 pl-4">{log.nextTodo}</p></div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer note */}
                    <div className="border-t border-slate-200 pt-6 text-center text-[10px] text-slate-400">
                      ※マップ型 思考ログ構築システムにより自動生成（未報告データのみの出力）
                    </div>

                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-400 font-bold space-y-2 max-w-lg mx-auto shadow-sm">
                    <p>現在、未報告の進捗ログはありません。</p>
                    <p className="text-[11px] text-slate-400 font-semibold">
                      すべての進捗が「報告済み」に設定されています。
                    </p>
                  </div>
                )}
              </div>
            )}

          </>
        )}
      </main>

      {/* 5. DEDICATED PRINT LAYOUT CONTAINER (FOR window.print() ONLY) */}
      <div className="print-only">
        <div className="border-b-4 border-slate-950 pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              週次進捗報告：思考ログ資料
            </h1>
            <span className="text-xs text-slate-600 font-bold mt-1 block">
              プロジェクト名: {selectedProject?.title}
            </span>
          </div>
          <div className="text-right text-xs text-slate-500">
            <span>報告作成日: {new Date().toLocaleDateString("ja-JP")}</span>
          </div>
        </div>

        <div className="space-y-8">
          {unreportedLogsByNode.length > 0 ? (
            unreportedLogsByNode.map((group, index) => (
              <div key={"print-group-" + index} className="space-y-4 break-inside-avoid">
                <h3 className="text-sm font-black text-indigo-950 bg-slate-100 border-l-4 border-slate-800 px-3 py-1 rounded">
                  【対象領域：{group.nodeLabel}】
                </h3>

                <div className="space-y-6 pl-2">
                  {group.logs.map((log, logIdx) => (
                    <div
                      key={"print-log-" + log.id}
                      className="border-b border-dashed border-slate-300 pb-4 last:border-none last:pb-0 space-y-3 text-xs"
                    >
                      <div className="text-[10px] text-slate-400 font-black flex justify-between">
                        <span>進捗ログ #{logIdx + 1}</span>
                        <span>記録日: {new Date(log.createdAt).toLocaleDateString("ja-JP")}</span>
                      </div>

                                            <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug">■ Situation (状況)</h4><p className="text-slate-700 pl-4">{log.situation}</p></div>
                      <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug">■ Task (課題)</h4><p className="text-slate-800 font-semibold pl-4">{log.task}</p></div>
                      <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug">■ Action (行動)</h4><p className="text-slate-700 pl-4 leading-relaxed whitespace-pre-wrap">{log.action}</p></div>
                      <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug">■ Result (結果)</h4><p className="text-slate-800 font-semibold pl-4">{log.result}</p></div>
                      {log.question && <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug">■ Question (相談)</h4><p className="text-slate-900 font-bold pl-4">❓ {log.question}</p></div>}
                      {log.nextTodo && <div className="space-y-0.5"><h4 className="font-bold text-slate-900 leading-snug">■ Next (次)</h4><p className="text-slate-700 pl-4">{log.nextTodo}</p></div>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-slate-400 py-12">未報告の進捗ログはありません。</p>
          )}
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400">
          ※マップ型 思考ログ構築システムにより自動生成（未報告データのみの出力）
        </div>
      </div>

      {/* MODALS */}

      {/* PASSCODE MODAL */}
      {showPasscodeModal && (
        <div className="no-print fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm">
                <Lock className="w-5 h-5 text-emerald-600 animate-pulse" />
                <span>資料作成者認証（管理者用）</span>
              </h3>
              <button
                onClick={() => {
                  setShowPasscodeModal(false);
                  setPasscodeError(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">
                  認証用のパスコードを入力してください:
                </label>
                <input
                  type="password"
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder="パスコード"
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  autoFocus
                />
                {passcodeError && (
                  <p className="text-[11px] text-rose-500 font-bold">パスコードが正しくありません。</p>
                )}
                <p className="text-[10px] text-slate-400 leading-normal">
                  ※初期状態では任意の非空パスコード、または &apos;admin&apos; でログイン可能です。
                </p>
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2 rounded-xl text-xs transition"
              >
                ログイン
              </button>
            </form>
          </div>
        </div>
      )}

      {/* GEMINI KEY CONFIG MODAL */}
      {showKeyModal && (
        <div className="no-print fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm">
                <Settings className="w-5 h-5 text-amber-500" />
                <span>Gemini APIキー設定</span>
              </h3>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveApiKey} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">
                  Gemini API キー (ブラウザのローカルストレージにのみ保存されます):
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 text-xs focus:outline-none font-mono"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  キーはお客様のブラウザ内に安全に保管され、Next.jsのAPIルート経由でGemini APIに接続時のみ使われます。
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    saveGeminiApiKey("");
                    setApiKeyInput("");
                    setShowKeyModal(false);
                    showToast("APIキーをクリアしました。");
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold"
                >
                  キーを消去
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-lg text-xs shadow-md transition"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PROJECT MODAL */}
      {showAddProjectModal && (
        <div className="no-print fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm">
                <FolderPlus className="w-5 h-5 text-emerald-600" />
                <span>新規プロジェクト作成</span>
              </h3>
              <button
                onClick={() => setShowAddProjectModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">
                  プロジェクトのタイトル:
                </label>
                <input
                  type="text"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="例：卒論・システム自動設計"
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-xl text-xs transition shadow-md"
              >
                プロジェクトを作成して開始
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD CHILD NODE MODAL */}
      {showAddNodeModal && (
        <div className="no-print fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                <span>手動で子ノード追加</span>
              </h3>
              <button
                onClick={() => setShowAddNodeModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddNodeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">
                  ノードの表示ラベル名:
                </label>
                <input
                  type="text"
                  value={newNodeLabelInput}
                  onChange={(e) => setNewNodeLabelInput(e.target.value)}
                  placeholder="例：追加課題の分析と実験設計"
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
                  autoFocus
                />
              </div>
              <div className="text-xs text-slate-500">
                親ノード:{" "}
                <span className="font-black text-slate-700">
                  {nodes.find((n) => n.id === newNodeParentIdInput)?.label || "なし（Root）"}
                </span>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-2 rounded-xl text-xs transition shadow"
              >
                ノードをマップに追加
              </button>
            </form>
          </div>
        </div>
      )}

      {/* COLLECTIVE SUMMARY RESULT MODAL */}
      {collectiveSummaryResult && (
        <div className="no-print fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm">
                <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                <span>選択した {checkedLogIds.size} 件の進捗：一括要約結果</span>
              </h3>
              <button
                onClick={() => setCollectiveSummaryResult(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed max-h-[400px] overflow-y-auto pr-2">
              {/* Situation */}
              <div className="space-y-1 bg-blue-50/40 p-3 rounded-xl border border-blue-100">
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">
                  Situation
                </span>
                <p className="font-bold text-slate-800 whitespace-pre-wrap">
                  {collectiveSummaryResult.situation || ""}
                </p>
              </div>

              {/* Task */}
              <div className="space-y-1 bg-purple-50/40 p-3 rounded-xl border border-purple-100">
                <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider block">
                  Task
                </span>
                <p className="font-bold text-slate-800 whitespace-pre-wrap">
                  {collectiveSummaryResult.task || ""}
                </p>
              </div>

              {/* Action */}
              <div className="space-y-1 bg-amber-50/40 p-3 rounded-xl border border-amber-100">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">
                  Action
                </span>
                <p className="text-slate-700 whitespace-pre-wrap">
                  {collectiveSummaryResult.action || ""}
                </p>
              </div>

              {/* Result */}
              <div className="space-y-1 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                  Result
                </span>
                <p className="font-bold text-slate-900 whitespace-pre-wrap">
                  {collectiveSummaryResult.result || ""}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setCollectiveSummaryResult(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-5 py-2 rounded-xl shadow transition"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION MESSAGE */}
      {toastMessage && (
        <div className="no-print fixed bottom-6 right-6 bg-slate-950/95 backdrop-blur-sm text-white text-xs px-4 py-3 rounded-xl shadow-xl z-50 flex items-center gap-2 border border-slate-800 animate-slideUp font-bold">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
