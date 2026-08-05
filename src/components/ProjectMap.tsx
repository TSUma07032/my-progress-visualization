/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ProjectNode } from "../lib/types";

interface ProjectMapProps {
  nodesList: ProjectNode[];
  currentNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  isCreator: boolean;
  onAddChildNode?: (parentId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  unspokenNodeIds?: Set<string>; // ノード内の未報告ログの有無
}

export default function ProjectMap({
  nodesList,
  currentNodeId,
  onSelectNode,
  isCreator,
  onAddChildNode,
  onDeleteNode,
  unspokenNodeIds = new Set(),
}: ProjectMapProps) {
  const [rfNodes, setRFNodes, onNodesChange] = useNodesState<any>([]);
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState<any>([]);

  // Track collapsed node IDs
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());

  // Determine which nodes actually have children in the original nodesList
  const nodesWithChildren = useMemo(() => {
    const set = new Set<string>();
    nodesList.forEach((n) => {
      if (n.parentId) {
        set.add(n.parentId);
      }
    });
    return set;
  }, [nodesList]);

  // Handle collapsing toggle
  const toggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering node select
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Simple layout engine to arrange nodes in a clean tree structure
  const { computedNodes, computedEdges } = useMemo(() => {
    if (nodesList.length === 0) {
      return { computedNodes: [], computedEdges: [] };
    }

    // Helper to recursively check if an ancestor is collapsed
    const isNodeVisible = (nodeId: string): boolean => {
      const n = nodesList.find((item) => item.id === nodeId);
      if (!n) return false;
      if (!n.parentId) return true;
      if (collapsedNodeIds.has(n.parentId)) return false;
      return isNodeVisible(n.parentId);
    };

    // Filter only visible nodes
    const visibleNodes = nodesList.filter((node) => isNodeVisible(node.id));

    // Map parent to children for visible nodes
    const parentToChildren: Record<string, ProjectNode[]> = {};
    const rootNodes: ProjectNode[] = [];

    visibleNodes.forEach((node) => {
      if (!node.parentId) {
        rootNodes.push(node);
      } else {
        if (!parentToChildren[node.parentId]) {
          parentToChildren[node.parentId] = [];
        }
        parentToChildren[node.parentId].push(node);
      }
    });

    // If no explicit root nodes, treat first visible node as root
    if (rootNodes.length === 0 && visibleNodes.length > 0) {
      rootNodes.push(visibleNodes[0]);
    }

    const nodePositions: Record<string, { x: number; y: number }> = {};
    const levels: Record<number, string[]> = {};

    // DFS to find depth level and order
    const assignLevels = (nodeId: string, depth: number) => {
      if (!levels[depth]) levels[depth] = [];
      if (!levels[depth].includes(nodeId)) {
        levels[depth].push(nodeId);
      }
      const children = parentToChildren[nodeId] || [];
      children.forEach((child) => assignLevels(child.id, depth + 1));
    };

    rootNodes.forEach((root) => assignLevels(root.id, 0));

    // Determine positions
    const verticalSpacing = 140;
    const horizontalSpacing = 240;

    Object.keys(levels).forEach((depthStr) => {
      const depth = parseInt(depthStr);
      const levelNodeIds = levels[depth];
      const totalWidth = (levelNodeIds.length - 1) * horizontalSpacing;
      const startX = -totalWidth / 2;

      levelNodeIds.forEach((nodeId, idx) => {
        nodePositions[nodeId] = {
          x: startX + idx * horizontalSpacing,
          y: depth * verticalSpacing + 50,
        };
      });
    });

    // Format nodes for React Flow
    const formattedNodes = visibleNodes.map((node) => {
      const isCurrent = node.id === currentNodeId;
      const isUnspoken = unspokenNodeIds.has(node.id);
      const isCollapsed = collapsedNodeIds.has(node.id);
      const hasChildren = nodesWithChildren.has(node.id);
      const pos = nodePositions[node.id] || { x: 0, y: 0 };

      return {
        id: node.id,
        position: pos,
        data: {
          label: (
            <div className="relative group p-2 text-center select-none">
              <div className="font-semibold text-xs text-gray-800 break-words max-w-[180px]">
                {node.label}
              </div>

              {/* Expand / Collapse Indicator Button */}
              {hasChildren && (
                <button
                  onClick={(e) => toggleCollapse(node.id, e)}
                  className={`absolute -top-3.5 right-4 w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full shadow-sm transition-all duration-200 border ${
                    isCollapsed
                      ? "bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700"
                      : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                  }`}
                  title={isCollapsed ? "展開する" : "折りたたむ"}
                >
                  {isCollapsed ? "＋" : "－"}
                </button>
              )}

              {/* Status Indicator Badges */}
              {isCurrent && (
                <span className="absolute -top-3 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-bounce">
                  現在地
                </span>
              )}

              {isUnspoken && !isCurrent && (
                <span className="absolute -top-3 -left-2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                  未報告
                </span>
              )}

              {/* Creator controls */}
              {isCreator && node.id !== "node-root" && onDeleteNode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`ノード「${node.label}」を削除しますか？紐づく進捗ログも非表示になります。`)) {
                      onDeleteNode(node.id);
                    }
                  }}
                  className="absolute -top-3 -left-3 hidden group-hover:flex bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 items-center justify-center text-[10px] font-bold transition shadow"
                  title="ノードを削除"
                >
                  ✕
                </button>
              )}
              {isCreator && onAddChildNode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChildNode(node.id);
                  }}
                  className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-blue-500 hover:bg-blue-600 text-white rounded-full px-1.5 py-0.5 items-center justify-center text-[9px] font-bold transition shadow whitespace-nowrap"
                  title="子ノードを追加"
                >
                  + 子ノード
                </button>
              )}
            </div>
          ),
        },
        style: {
          background: isCurrent
            ? "#ecfdf5" // light emerald
            : isUnspoken
            ? "#fffbeb" // light amber
            : "#ffffff",
          border: isCurrent
            ? "2px solid #10b981" // emerald-500
            : isUnspoken
            ? "2px dashed #f59e0b" // amber dashed
            : "1px solid #e5e7eb",
          borderRadius: "8px",
          boxShadow: isCurrent
            ? "0 4px 12px rgba(16, 185, 129, 0.2)"
            : isUnspoken
            ? "0 4px 10px rgba(245, 158, 11, 0.15)"
            : "0 2px 6px rgba(0,0,0,0.05)",
          color: "#1f2937",
          cursor: "pointer",
          padding: "4px",
          transition: "all 0.2s ease",
        },
        type: "default",
      };
    });

    // Format edges for React Flow
    const formattedEdges: any[] = [];
    visibleNodes.forEach((node) => {
      if (node.parentId && visibleNodes.some((n) => n.id === node.parentId)) {
        formattedEdges.push({
          id: `e-${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          type: "smoothstep",
          animated: node.id === currentNodeId,
          style: {
            stroke: node.id === currentNodeId ? "#10b981" : "#9ca3af",
            strokeWidth: node.id === currentNodeId ? 3 : 1.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: node.id === currentNodeId ? "#10b981" : "#9ca3af",
          },
        });
      }
    });

    return { computedNodes: formattedNodes, computedEdges: formattedEdges };
  }, [nodesList, currentNodeId, isCreator, onAddChildNode, onDeleteNode, collapsedNodeIds, nodesWithChildren, unspokenNodeIds]);

  useEffect(() => {
    setRFNodes(computedNodes);
    setRFEdges(computedEdges);
  }, [computedNodes, computedEdges, setRFNodes, setRFEdges]);

  const onNodeClick = (_: any, node: any) => {
    onSelectNode(node.id);
  };

  return (
    <div className="w-full h-full bg-slate-50 relative border border-slate-200 rounded-xl overflow-hidden shadow-inner">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Controls />
        <MiniMap zoomable pannable style={{ height: 100, width: 150 }} />
        <Background color="#94a3b8" gap={16} size={1} />
      </ReactFlow>

      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur px-3 py-2 rounded-lg text-[11px] text-slate-500 shadow border border-slate-200 z-10 space-y-1">
        <div className="font-bold text-slate-700 mb-0.5">凡例:</div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 bg-white border border-emerald-500 rounded-sm"></span>
          <span>現在地ノード（今週の進捗箇所）</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 bg-amber-50 border-2 border-dashed border-amber-500 rounded-sm"></span>
          <span>未報告ログが存在するノード</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 bg-indigo-600 rounded-full flex items-center justify-center text-[8px] text-white">＋</span>
          <span>折りたたまれた子ノードあり（クリックで展開）</span>
        </div>
        {isCreator && (
          <div className="text-[10px] text-blue-600 font-medium pt-0.5">
            💡 ノードにホバーすると「子ノード追加」「削除」ボタンが表示されます
          </div>
        )}
      </div>
    </div>
  );
}
