/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { dbService } from "../lib/dbService";
import { Project, ProjectNode, ProgressLog } from "../lib/types";
import ProjectMap from "../components/ProjectMap";
import {
  FileText,
  Lock,
  Unlock,
  Settings,
  Plus,
  RefreshCw,
  Database,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  History,
  Printer,
  Edit2,
  Trash2,
  X,
  PlusCircle,
  HelpCircle,
  FolderPlus,
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

  // Selected Node for History filtering
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Input & Edit States for Creator
  const [rawMemo, setRawMemo] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // AI Output Override States
  const [analyzedResult, setAnalyzedResult] = useState<{
    conclusion: string;
    struggle: string;
    discussion: string;
    nodeId: string | null;
    newNodeLabel: string | null;
    newNodeParentId: string | null;
  } | null>(null);
  const [isResultSimulated, setIsResultSimulated] = useState(false);

  // UI Modals & Popups
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

  // Manual editing of log details (edit log in history list)
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editConclusion, setEditConclusion] = useState("");
  const [editStruggle, setEditStruggle] = useState("");
  const [editDiscussion, setEditDiscussion] = useState("");

  // Loading indicator for fetching data
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Print Target for PDF Export
  const [printLog, setPrintLog] = useState<ProgressLog | null>(null);

  // Toast / notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Initial Load and Database Mode triggers
  useEffect(() => {
    if (!isMounted) return;
    loadAllData();
  }, [isMounted, storageMode]);

  const loadAllData = async (targetProjId?: string) => {
    setIsLoadingData(true);
    try {
      const projList = await dbService.getProjects();
      setProjects(projList);

      if (projList.length > 0) {
        // Select either the specified target, or the previously selected if still valid, or first
        const active =
          projList.find((p) => p.id === targetProjId) ||
          projList.find((p) => p.id === selectedProject?.id) ||
          projList[0];
        setSelectedProject(active);

        // Load nodes and logs
        const nodeList = await dbService.getNodes(active.id);
        const logList = await dbService.getLogs(active.id);

        setNodes(nodeList);
        setLogs(logList);

        // Highlight root or default node if nothing is selected
        const rootNode = nodeList.find((n) => n.parentId === null);
        if (rootNode) {
          setSelectedNodeId(rootNode.id);
        } else if (nodeList.length > 0) {
          setSelectedNodeId(nodeList[0].id);
        } else {
          setSelectedNodeId(null);
        }
      } else {
        setSelectedProject(null);
        setNodes([]);
        setLogs([]);
        setSelectedNodeId(null);
      }
    } catch (err) {
      console.error("Error loading data", err);
      showToast("データの読み込み中にエラーが発生しました。");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Handle switching project
  const handleSelectProject = async (proj: Project) => {
    setSelectedProject(proj);
    setIsLoadingData(true);
    const nodeList = await dbService.getNodes(proj.id);
    const logList = await dbService.getLogs(proj.id);
    setNodes(nodeList);
    setLogs(logList);

    const rootNode = nodeList.find((n) => n.parentId === null);
    if (rootNode) {
      setSelectedNodeId(rootNode.id);
    } else if (nodeList.length > 0) {
      setSelectedNodeId(nodeList[0].id);
    } else {
      setSelectedNodeId(null);
    }
    setRawMemo("");
    setAnalyzedResult(null);
    setIsLoadingData(false);
  };

  // 2. Creator passcode unlock
  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = unlockCreator(passcodeInput);
    if (success) {
      setShowPasscodeModal(false);
      setPasscodeInput("");
      setPasscodeError(false);
      showToast("資料作成者としてログインしました。");
    } else {
      setPasscodeError(true);
    }
  };

  // 3. Project Creation
  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    try {
      const newProj = await dbService.createProject(newProjectTitle.trim());
      showToast(`プロジェクト「${newProj.title}」を作成しました。`);
      setShowAddProjectModal(false);
      setNewProjectTitle("");
      await loadAllData(newProj.id);
    } catch (err) {
      console.error("Failed to create project", err);
      showToast("プロジェクトの作成に失敗しました。");
    }
  };

  // 4. API Key setup
  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    saveGeminiApiKey(apiKeyInput.trim());
    setShowKeyModal(false);
    showToast("Gemini APIキーを保存しました。");
  };

  // 5. Trigger AI Analysis
  const handleAIAnalyze = async () => {
    if (!rawMemo.trim()) {
      showToast("メモ内容を入力してください。");
      return;
    }
    if (!selectedProject) {
      showToast("プロジェクトを選択、または新規作成してください。");
      return;
    }

    setIsAnalyzing(true);
    setApiError(null);
    setAnalyzedResult(null);

    // Prepare current node simplified mapping context to pass to Gemini
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
          useSimulation: !geminiApiKey, // auto-simulate if no key
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || errData.error || "AI解析サーバーでエラーが発生しました。");
      }

      const data = await response.json();
      setAnalyzedResult({
        conclusion: data.conclusion,
        struggle: data.struggle,
        discussion: data.discussion,
        nodeId: data.nodeId,
        newNodeLabel: data.newNodeLabel,
        newNodeParentId: data.newNodeParentId,
      });
      setIsResultSimulated(data.isSimulated);
      showToast(data.isSimulated ? "シミュレーション結果を生成しました。" : "AIによる思考分析が完了しました！");
    } catch (err: any) {
      console.error("Analysis failed", err);
      setApiError(err.message || "通信エラーが発生しました。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 6. Save Progress Log to Database
  const handleSaveProgressLog = async () => {
    if (!selectedProject || !analyzedResult) return;

    let targetNodeId = analyzedResult.nodeId;

    try {
      // Check if we need to auto-generate a new node
      if (!targetNodeId && analyzedResult.newNodeLabel) {
        const createdNode = await dbService.createNode(
          selectedProject.id,
          analyzedResult.newNodeLabel,
          analyzedResult.newNodeParentId
        );
        targetNodeId = createdNode.id;
        showToast(`新規ノード「${createdNode.label}」を自動追加しました。`);
      }

      // If still no node ID, map to Uncategorized or Root
      if (!targetNodeId) {
        const existingUncat = nodes.find((n) => n.label.includes("未分類") || n.id === "uncat");
        if (existingUncat) {
          targetNodeId = existingUncat.id;
        } else {
          const rootNode = nodes.find((n) => n.parentId === null) || nodes[0];
          const uncatNode = await dbService.createNode(
            selectedProject.id,
            "未分類 (Uncategorized)",
            rootNode ? rootNode.id : null
          );
          targetNodeId = uncatNode.id;
        }
      }

      // Register the Progress Log
      await dbService.createLog(
        selectedProject.id,
        targetNodeId,
        rawMemo,
        analyzedResult.conclusion,
        analyzedResult.struggle,
        analyzedResult.discussion
      );

      // Refresh data
      const updatedNodes = await dbService.getNodes(selectedProject.id);
      const updatedLogs = await dbService.getLogs(selectedProject.id);
      setNodes(updatedNodes);
      setLogs(updatedLogs);

      // Select and highlight this node
      setSelectedNodeId(targetNodeId);

      // Reset Form state
      setRawMemo("");
      setAnalyzedResult(null);
      showToast("進捗ログをマップと履歴に保存しました！");
    } catch (err) {
      console.error("Failed to save progress", err);
      showToast("進捗ログの保存に失敗しました。");
    }
  };

  // 7. Node Operations: Manual add & delete
  const handleAddChildNodeClick = (parentId: string) => {
    setNewNodeParentIdInput(parentId);
    setNewNodeLabelInput("");
    setShowAddNodeModal(true);
  };

  const handleAddNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newNodeLabelInput.trim()) return;

    try {
      const created = await dbService.createNode(
        selectedProject.id,
        newNodeLabelInput.trim(),
        newNodeParentIdInput
      );
      showToast(`ノード「${created.label}」を追加しました。`);
      setShowAddNodeModal(false);

      const nodeList = await dbService.getNodes(selectedProject.id);
      setNodes(nodeList);
      setSelectedNodeId(created.id);
    } catch (err) {
      console.error("Add node failed", err);
      showToast("ノードの追加に失敗しました。");
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!selectedProject) return;

    try {
      await dbService.deleteNode(selectedProject.id, nodeId);
      showToast("ノードを削除しました。");

      const nodeList = await dbService.getNodes(selectedProject.id);
      setNodes(nodeList);
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(nodeList[0]?.id || null);
      }
    } catch (err) {
      console.error("Delete node failed", err);
      showToast("ノードの削除に失敗しました。");
    }
  };

  // 8. History Log Operations: Edit & Delete
  const startEditingLog = (log: ProgressLog) => {
    setEditingLogId(log.id);
    setEditConclusion(log.conclusion);
    setEditStruggle(log.struggle);
    setEditDiscussion(log.discussion);
  };

  const saveEditedLog = async (logId: string) => {
    if (!selectedProject) return;

    try {
      await dbService.updateLog(selectedProject.id, logId, {
        conclusion: editConclusion,
        struggle: editStruggle,
        discussion: editDiscussion,
      });
      showToast("ログを更新しました。");
      setEditingLogId(null);

      const logList = await dbService.getLogs(selectedProject.id);
      setLogs(logList);
    } catch (err) {
      console.error("Update log failed", err);
      showToast("ログの更新に失敗しました。");
    }
  };

  const deleteLog = async (logId: string) => {
    if (!selectedProject) return;
    if (!confirm("この進捗ログを削除しますか？")) return;

    try {
      await dbService.deleteLog(selectedProject.id, logId);
      showToast("ログを削除しました。");

      const logList = await dbService.getLogs(selectedProject.id);
      setLogs(logList);
    } catch (err) {
      console.error("Delete log failed", err);
      showToast("ログの削除に失敗しました。");
    }
  };

  // 9. Printing logic
  const handlePrintLog = (log: ProgressLog) => {
    setPrintLog(log);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Compute stats and active items
  const activeNode = nodes.find((n) => n.id === selectedNodeId);
  const activeNodeLogs = logs.filter((l) => l.nodeId === selectedNodeId);
  const latestLog = logs.length > 0 ? logs[0] : null;

  // Render Loader if not fully mounted yet
  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500 gap-2">
        <RefreshCw className="animate-spin w-5 h-5" />
        <span>システムを初期化中...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. TOP HEADER BAR */}
      <header className="no-print bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-40 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-emerald-500 to-teal-600 text-white p-2.5 rounded-xl shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              マップ型 思考ログ構築システム
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">
              AI-driven Progress Tracking & Struggle Capture
            </p>
          </div>
        </div>

        {/* Database & Key Configuration Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Storage Switcher */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 text-xs border border-slate-200">
            <button
              onClick={() => setStorageMode("mock")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                storageMode === "mock"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="データをブラウザにローカル保存して検証します"
            >
              <Database className="w-3.5 h-3.5" />
              <span>モックモード</span>
            </button>
            <button
              onClick={() => setStorageMode("firebase")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                storageMode === "firebase"
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Firebase Firestoreと本番接続します"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Firebase</span>
            </button>
          </div>

          {/* Gemini API Key config button */}
          <button
            onClick={() => {
              setApiKeyInput(geminiApiKey);
              setShowKeyModal(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
              geminiApiKey
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 animate-pulse"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>{geminiApiKey ? "Gemini 連携中" : "Gemini APIキーを設定"}</span>
          </button>

          {/* Creator Role Lock / Unlock Toggle */}
          {isCreator ? (
            <button
              onClick={lockCreator}
              className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-3 py-2 rounded-lg text-xs font-semibold transition"
              title="編集ロック（閲覧モードへ戻る）"
            >
              <Lock className="w-4 h-4" />
              <span>資料作成者（ログイン中）</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setPasscodeInput("");
                setShowPasscodeModal(true);
              }}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <Unlock className="w-4 h-4" />
              <span>資料作成者としてロック解除</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. SUB-HEADER FOR PROJECT SELECTION */}
      <section className="no-print bg-slate-100 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">選択中のプロジェクト:</span>
          {projects.length > 0 && selectedProject ? (
            <div className="relative inline-block">
              <select
                value={selectedProject.id}
                onChange={(e) => {
                  const target = projects.find((p) => p.id === e.target.value);
                  if (target) handleSelectProject(target);
                }}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8 appearance-none cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-400">プロジェクトがありません。</span>
          )}

          {isCreator && (
            <button
              onClick={() => setShowAddProjectModal(true)}
              className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-2 py-1.5 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新規プロジェクト</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>保存場所:</span>
          <span className={`font-semibold ${storageMode === "firebase" ? "text-emerald-600" : "text-blue-600"}`}>
            {storageMode === "firebase" ? "Firebase Firestore" : "ブラウザ LocalStorage"}
          </span>
        </div>
      </section>

      {/* 3. MAIN WORKSPACE AREA */}
      <main className="no-print flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        {/* LEFT COLUMN: MEMO INPUT / CURRENT PROGRESS PANEL (WIDTH 5 ON LG) */}
        <div className="lg:col-span-5 flex flex-col gap-6 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
          {isCreator ? (
            /* CREATOR VIEW: MEMO INPUT & AI WORKSPACE */
            <div className="bg-white rounded-xl shadow-md border border-slate-200 p-5 space-y-5 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-emerald-500 w-5 h-5" />
                  <h3 className="font-bold text-slate-800 text-sm">今週の進捗メモ入力</h3>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  AI解析ツール
                </span>
              </div>

              {/* Textarea for raw memo */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">
                  日々の活動・試行錯誤メモ (Notion等からの貼り付けもOK):
                </label>
                <textarea
                  value={rawMemo}
                  onChange={(e) => setRawMemo(e.target.value)}
                  placeholder="例：今週はReact Flowを用いた可視化UIの実装を進めた。ノードにカーソルを合わせた時のメニュー表示の挙動でバグが発生し、削除ボタンが押せないバグに半日詰まって苦戦した。CSSのz-index設定を調整し、イベント伝播（stopPropagation）を追加することで解決できた。来週はこれに紐づく過去ログ履歴の表示機能を仕上げたい。"
                  rows={8}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-400"
                />
              </div>

              {/* API Key warnings and simulation notes */}
              {!geminiApiKey && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Gemini APIキーが設定されていません</p>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      APIキーがない場合、**AIシミュレーション機能（ローカル擬似解析）**が自動的に働きます。実機でGeminiによる高精度な葛藤抽出を行いたい場合は、右上のボタンからAPIキーを設定してください。
                    </p>
                  </div>
                </div>
              )}

              {/* Trigger analyze button */}
              <div className="flex gap-2">
                <button
                  onClick={handleAIAnalyze}
                  disabled={isAnalyzing}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow transition flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="animate-spin w-4 h-4" />
                      <span>AI解析整理中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{geminiApiKey ? "AIに進捗メモを分析させる" : "シミュレーション解析を実行"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* API Error Notification */}
              {apiError && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span>AIによる整理に失敗しました</span>
                  </div>
                  <p className="text-red-600 leading-relaxed text-[11px]">{apiError}</p>
                  <button
                    onClick={handleAIAnalyze}
                    className="bg-red-100 hover:bg-red-200 text-red-800 font-bold px-2 py-1 rounded transition text-[10px]"
                  >
                    再試行
                  </button>
                </div>
              )}

              {/* Interactive Analyzed Results / Overrides */}
              {analyzedResult && (
                <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-4 space-y-4 shadow-sm animate-fadeIn">
                  {/* Mode / Simulation Warning */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      💡 解析抽出結果（手動編集・修正可能）:
                    </span>
                    {isResultSimulated ? (
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        AIシミュレーション実行中
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                        Gemini AI 解析
                      </span>
                    )}
                  </div>

                  {/* 1. Conclusion */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-emerald-800 uppercase tracking-wider">
                      1. 結論・進捗の要約:
                    </label>
                    <textarea
                      value={analyzedResult.conclusion}
                      onChange={(e) =>
                        setAnalyzedResult({ ...analyzedResult, conclusion: e.target.value })
                      }
                      rows={2}
                      className="w-full text-xs bg-white border border-slate-200 rounded p-2 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 2. Struggle */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-amber-800 uppercase tracking-wider">
                      2. 葛藤・試行錯誤（本音、省略せず残す箇所）:
                    </label>
                    <textarea
                      value={analyzedResult.struggle}
                      onChange={(e) =>
                        setAnalyzedResult({ ...analyzedResult, struggle: e.target.value })
                      }
                      rows={3}
                      className="w-full text-xs bg-white border border-slate-200 rounded p-2 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* 3. Discussion */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-indigo-800 uppercase tracking-wider">
                      3. 相談・議論ポイント:
                    </label>
                    <textarea
                      value={analyzedResult.discussion}
                      onChange={(e) =>
                        setAnalyzedResult({ ...analyzedResult, discussion: e.target.value })
                      }
                      rows={2}
                      className="w-full text-xs bg-white border border-slate-200 rounded p-2 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* 4. Mapping location */}
                  <div className="space-y-1 bg-white p-2 rounded border border-slate-200">
                    <label className="block text-[11px] font-black text-slate-700">
                      4. マップ上の現在地（紐付けノード）:
                    </label>

                    {analyzedResult.nodeId ? (
                      <div className="space-y-2">
                        <select
                          value={analyzedResult.nodeId}
                          onChange={(e) =>
                            setAnalyzedResult({
                              ...analyzedResult,
                              nodeId: e.target.value,
                              newNodeLabel: null,
                            })
                          }
                          className="w-full text-xs border border-slate-200 rounded p-1.5 bg-slate-50 font-medium"
                        >
                          {nodes.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.label}
                            </option>
                          ))}
                          <option value="">-- 新しい子ノードを自動生成する --</option>
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <div className="text-blue-600 font-bold bg-blue-50 p-2 rounded text-[10px] flex items-center gap-1.5 border border-blue-100">
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>AIの提案：既存ノードに該当しないため、新規ノードを追加します</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold">新規ノード名:</span>
                            <input
                              type="text"
                              value={analyzedResult.newNodeLabel || ""}
                              onChange={(e) =>
                                setAnalyzedResult({
                                  ...analyzedResult,
                                  newNodeLabel: e.target.value,
                                })
                              }
                              className="w-full text-xs border border-slate-200 rounded p-1"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold">親ノードの指定:</span>
                            <select
                              value={analyzedResult.newNodeParentId || ""}
                              onChange={(e) =>
                                setAnalyzedResult({
                                  ...analyzedResult,
                                  newNodeParentId: e.target.value || null,
                                })
                              }
                              className="w-full text-xs border border-slate-200 rounded p-1"
                            >
                              <option value="">なし (ルートノードとして追加)</option>
                              {nodes.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Switch back to existing toggle */}
                        <button
                          onClick={() => {
                            if (nodes.length > 0) {
                              setAnalyzedResult({
                                ...analyzedResult,
                                nodeId: nodes[0].id,
                                newNodeLabel: null,
                                newNodeParentId: null,
                              });
                            }
                          }}
                          className="text-[10px] text-emerald-600 font-bold underline block mt-1 hover:text-emerald-700"
                        >
                          既存ノードから手動で選択する
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Save button */}
                  <button
                    onClick={handleSaveProgressLog}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow flex items-center justify-center gap-1.5"
                  >
                    <span>この進捗データをマップに登録 (保存)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* READER VIEW: CURRENT LATEST PROGRESS SUMMARY CARD */
            <div className="bg-white rounded-xl shadow-md border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="text-emerald-600 w-5 h-5" />
                  <h3 className="font-bold text-slate-800 text-sm">今週の最新進捗サマリー</h3>
                </div>
                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  閲覧モード
                </span>
              </div>

              {latestLog ? (
                <div className="space-y-4">
                  {/* Latest Conclusion */}
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3">
                    <span className="block text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-1">
                      1. 今週の成果・結論
                    </span>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {latestLog.conclusion}
                    </p>
                  </div>

                  {/* Latest Struggle */}
                  <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                    <span className="block text-[10px] font-black text-amber-800 uppercase tracking-wider mb-1">
                      2. 本音の葛藤と試行錯誤
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {latestLog.struggle}
                    </p>
                  </div>

                  {/* Latest Discussion */}
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3">
                    <span className="block text-[10px] font-black text-indigo-800 uppercase tracking-wider mb-1">
                      3. 上司・教授への相談ポイント
                    </span>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {latestLog.discussion}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handlePrintLog(latestLog)}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>今週の進捗を印刷 (A4用紙最適化)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-xs py-8 text-center space-y-2">
                  <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>登録された進捗ログがまだありません。</p>
                  <p className="text-[10px]">資料作成者モードに切り替えて、最初の進捗メモを入力してみましょう！</p>
                </div>
              )}
            </div>
          )}

          {/* SHARED TIPS BLOCK */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-950 text-white rounded-xl p-5 shadow-lg space-y-3">
            <h4 className="font-bold text-xs tracking-wide text-emerald-400 flex items-center gap-1.5">
              <span>💡</span> システムの活用ノウハウ
            </h4>
            <ul className="text-[11px] text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
              <li>
                <span className="font-bold text-white">葛藤や本音を残すメリット:</span> うまく進まない部分や迷っている点をあえて言語化することで、本質的なボトルネックを他者と共有できます。
              </li>
              <li>
                <span className="font-bold text-white">現在地のハイライト:</span> マップ上で緑色に輝く箇所が今週の進捗地点です。クリックして過去のログ一覧も見てみましょう。
              </li>
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN: MAP WORKSPACE & DETAIL HISTORY (WIDTH 7 ON LG) */}
        <div className="lg:col-span-7 flex flex-col gap-6 max-h-[calc(100vh-180px)]">
          {/* MAP DISPLAY (HEIGHT 60% OR FLEX GROW) */}
          <div className="flex-1 min-h-[400px] flex flex-col bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="font-bold text-slate-800 text-sm">プロジェクト全体像マップ</h3>
              </div>
              <div className="text-[11px] text-slate-500">
                ノード数: <span className="font-bold text-slate-800">{nodes.length}</span> 個
              </div>
            </div>

            {isLoadingData ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-xs gap-2">
                <RefreshCw className="animate-spin w-4 h-4" />
                <span>データをロード中...</span>
              </div>
            ) : nodes.length > 0 ? (
              <div className="flex-1">
                <ProjectMap
                  nodesList={nodes}
                  currentNodeId={latestLog ? latestLog.nodeId : null}
                  onSelectNode={(id) => setSelectedNodeId(id)}
                  isCreator={isCreator}
                  onAddChildNode={handleAddChildNodeClick}
                  onDeleteNode={handleDeleteNode}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-400 text-xs flex-col gap-2 p-6">
                <Plus className="w-8 h-8 text-slate-300" />
                <p className="font-semibold text-slate-600">プロジェクトのマップノードがありません</p>
                {isCreator ? (
                  <button
                    onClick={() => handleAddChildNodeClick("")}
                    className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
                  >
                    最初のルートノードを追加する
                  </button>
                ) : (
                  <p className="text-[10px]">資料作成者が最初のノードを追加するのをお待ちください。</p>
                )}
              </div>
            )}
          </div>

          {/* HISTORIES OF SELECTED NODE (HEIGHT 40%) */}
          <div className="h-[280px] bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <History className="text-indigo-600 w-4 h-4" />
                <h3 className="font-bold text-slate-800 text-sm">
                  {activeNode ? `「${activeNode.label}」の進捗履歴` : "ノードの進捗履歴"}
                </h3>
              </div>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded">
                履歴 {activeNodeLogs.length} 件
              </span>
            </div>

            {activeNode ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {activeNodeLogs.length > 0 ? (
                  activeNodeLogs.map((log) => {
                    const isEditing = editingLogId === log.id;

                    return (
                      <div
                        key={log.id}
                        className="border border-slate-100 rounded-lg p-4 bg-slate-50/50 space-y-3 relative hover:border-indigo-100 hover:bg-slate-50 transition"
                      >
                        {/* Header of log card */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-medium">
                            登録日時: {new Date(log.createdAt).toLocaleString("ja-JP")}
                          </span>

                          <div className="flex items-center gap-2 no-print">
                            <button
                              onClick={() => handlePrintLog(log)}
                              className="text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                              title="このログ単体を印刷"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>印刷</span>
                            </button>

                            {isCreator && (
                              <>
                                {!isEditing ? (
                                  <button
                                    onClick={() => startEditingLog(log)}
                                    className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>編集</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => saveEditedLog(log.id)}
                                    className="text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-0.5"
                                  >
                                    <span>保存</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => deleteLog(log.id)}
                                  className="text-red-500 hover:text-red-700 flex items-center gap-0.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>削除</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Log fields (View / Edit Form) */}
                        {isEditing ? (
                          <div className="space-y-3 text-xs">
                            <div className="space-y-1">
                              <span className="font-black text-emerald-800 text-[10px] block">進捗の結論:</span>
                              <textarea
                                value={editConclusion}
                                onChange={(e) => setEditConclusion(e.target.value)}
                                rows={2}
                                className="w-full border border-slate-200 rounded p-1.5"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="font-black text-amber-800 text-[10px] block">葛藤・試行錯誤:</span>
                              <textarea
                                value={editStruggle}
                                onChange={(e) => setEditStruggle(e.target.value)}
                                rows={3}
                                className="w-full border border-slate-200 rounded p-1.5"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="font-black text-indigo-800 text-[10px] block">相談ポイント:</span>
                              <textarea
                                value={editDiscussion}
                                onChange={(e) => setEditDiscussion(e.target.value)}
                                rows={2}
                                className="w-full border border-slate-200 rounded p-1.5"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2.5 text-xs">
                            <div className="bg-white p-2 rounded border border-slate-100">
                              <span className="font-extrabold text-emerald-700 text-[10px] block mb-0.5">
                                ◆ 進捗の結論
                              </span>
                              <p className="text-slate-700 leading-relaxed font-semibold">
                                {log.conclusion}
                              </p>
                            </div>
                            <div className="bg-white p-2 rounded border border-slate-100">
                              <span className="font-extrabold text-amber-700 text-[10px] block mb-0.5">
                                ◆ 本音の葛藤と試行錯誤
                              </span>
                              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {log.struggle}
                              </p>
                            </div>
                            <div className="bg-white p-2 rounded border border-slate-100">
                              <span className="font-extrabold text-indigo-700 text-[10px] block mb-0.5">
                                ◆ 相談・議論ポイント
                              </span>
                              <p className="text-slate-600 leading-relaxed font-semibold">
                                {log.discussion}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-400 text-xs py-8 text-center">
                    このノードに紐づく過去の進捗ログはありません。
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs text-center">
                マップ上のノードをクリックすると、紐づく進捗ログ履歴が表示されます。
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 4. MODALS & POPUPS (NO-PRINT) */}
      {/* 4.1 CREATOR PASSCODE MODAL */}
      {showPasscodeModal && (
        <div className="no-print fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Unlock className="w-5 h-5 text-emerald-600" />
                <span>作成者ロックを解除</span>
              </h3>
              <button
                onClick={() => setShowPasscodeModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">
                  作成用パスコードを入力:
                </label>
                <input
                  type="password"
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder="admin"
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
                {passcodeError && (
                  <p className="text-[11px] text-red-500 font-bold">パスコードが正しくありません。</p>
                )}
                <p className="text-[10px] text-slate-400 leading-normal">
                  ※初期状態では任意のパスコード、または &apos;admin&apos; と入力するだけで解除可能です。環境変数 `NEXT_PUBLIC_CREATOR_PASSCODE` を設定することでロックできます。
                </p>
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs"
              >
                認証してロック解除
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4.2 GEMINI KEY CONFIG MODAL */}
      {showKeyModal && (
        <div className="no-print fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" />
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
                  Gemini API キー (ブラウザにのみ保存されます):
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 text-xs"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  キーはお客様のブラウザの `localStorage` に安全に保管され、Next.jsのAPIルート経由でGemini APIへの問い合わせ時にのみ使用されます。
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    dbService.createProject("自律型AIエージェント開発プロジェクト"); // seed helper if lost
                    saveGeminiApiKey("");
                    setApiKeyInput("");
                    setShowKeyModal(false);
                    showToast("APIキーをクリアしました。");
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs"
                >
                  キーを消去
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4.3 ADD PROJECT MODAL */}
      {showAddProjectModal && (
        <div className="no-print fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
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
                  placeholder="例：卒業研究・システム自動開発"
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs"
              >
                プロジェクトを作成して開始
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4.4 ADD CHILD NODE MODAL */}
      {showAddNodeModal && (
        <div className="no-print fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                <span>手動ノード追加</span>
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
                  ノードの名称・表示名:
                </label>
                <input
                  type="text"
                  value={newNodeLabelInput}
                  onChange={(e) => setNewNodeLabelInput(e.target.value)}
                  placeholder="例：実験3：追加テストデータの評価"
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="text-xs text-slate-500">
                親ノード:{" "}
                <span className="font-bold text-slate-700">
                  {nodes.find((n) => n.id === newNodeParentIdInput)?.label || "なし（Root）"}
                </span>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs"
              >
                ノードをマップに追加
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. DEDICATED PRINT LAYOUT CONTAINER */}
      {printLog && (
        <div className="print-only">
          <div className="border-b-4 border-slate-900 pb-4 mb-6">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              進捗報告資料：マップ型 思考ログ
            </h1>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-2 font-semibold">
              <span>プロジェクト: {selectedProject?.title}</span>
              <span>報告作成日時: {new Date(printLog.createdAt).toLocaleDateString("ja-JP")}</span>
            </div>
          </div>

          <div className="space-y-8">
            {/* 1. Conclusion */}
            <div className="p-5 border-2 border-emerald-500 rounded-xl bg-emerald-50/10">
              <h2 className="text-sm font-black text-emerald-800 tracking-wider border-b border-emerald-200 pb-1.5 mb-3 uppercase">
                1. 今週の進捗・結論要約
              </h2>
              <p className="text-sm text-slate-800 font-bold leading-relaxed whitespace-pre-wrap">
                {printLog.conclusion}
              </p>
            </div>

            {/* 2. Struggle */}
            <div className="p-5 border-2 border-amber-500 rounded-xl bg-amber-50/10">
              <h2 className="text-sm font-black text-amber-800 tracking-wider border-b border-amber-200 pb-1.5 mb-3 uppercase">
                2. 葛藤と試行錯誤プロセス（本音、省略せず残す箇所）
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {printLog.struggle}
              </p>
            </div>

            {/* 3. Discussion */}
            <div className="p-5 border-2 border-indigo-500 rounded-xl bg-indigo-50/10">
              <h2 className="text-sm font-black text-indigo-800 tracking-wider border-b border-indigo-200 pb-1.5 mb-3 uppercase">
                3. 今後の相談・議論のテーマ
              </h2>
              <p className="text-sm text-slate-800 font-bold leading-relaxed whitespace-pre-wrap">
                {printLog.discussion}
              </p>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400">
            マップ型 思考ログ構築システムにより自動生成・管理
          </div>
        </div>
      )}

      {/* 6. TOAST NOTIFICATIONS (NO-PRINT) */}
      {toastMessage && (
        <div className="no-print fixed bottom-6 right-6 bg-slate-900/95 backdrop-blur-sm text-white text-xs px-4 py-3 rounded-xl shadow-xl z-50 flex items-center gap-2 border border-slate-800 animate-slideUp">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
