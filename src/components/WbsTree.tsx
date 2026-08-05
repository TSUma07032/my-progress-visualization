import React, { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableTreeItem } from './SortableTreeItem';
import { WbsNode, WbsNodeWithNumber } from '../lib/types';
import { buildWbsTree } from '../lib/wbsUtils';

interface WbsTreeProps {
  nodes: WbsNode[];
  activeNodeId: string | null;
  onSelectNode: (node: WbsNodeWithNumber) => void;
  onReorder: (nodeId: string, newParentId: string | null, prevId: string | null, nextId: string | null, newLevel: number) => void;
}

export function WbsTree({ nodes, activeNodeId, onSelectNode, onReorder }: WbsTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeDragNode, setActiveDragNode] = useState<WbsNodeWithNumber | null>(null);

  const tree = useMemo(() => buildWbsTree(nodes), [nodes]);

  // Flatten the tree for sorting context and rendering based on expanded state
  const flattenedNodes = useMemo(() => {
    const flat: { node: WbsNodeWithNumber; depth: number }[] = [];

    function flatten(children: WbsNodeWithNumber[], depth: number) {
      for (const node of children) {
        flat.push({ node, depth });
        if (expandedIds.has(node.id) && node.children) {
          flatten(node.children, depth + 1);
        }
      }
    }

    flatten(tree, 0);
    return flat;
  }, [tree, expandedIds]);

  const sortableIds = flattenedNodes.map(item => item.node.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleExpand = (nodeId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const node = flattenedNodes.find(n => n.node.id === active.id)?.node;
    if (node) setActiveDragNode(node);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragNode(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const activeIndex = flattenedNodes.findIndex(n => n.node.id === active.id);
    const overIndex = flattenedNodes.findIndex(n => n.node.id === over.id);

    if (activeIndex === -1 || overIndex === -1) return;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _activeItem = flattenedNodes[activeIndex];
    const overItem = flattenedNodes[overIndex];

    // Very simple drop logic for this phase:
    // Drop before or after the overItem, inheriting its parent.
    // In a full implementation we'd check if we drop *into* an item to reparent.

    const isBelow = overIndex > activeIndex;
    const newParentId = overItem.node.parent_id;
    const newLevel = overItem.node.node_level;

    let prevId: string | null = null;
    let nextId: string | null = null;

    // Find siblings in the new parent context to determine rank
    const siblings = nodes.filter(n => n.parent_id === newParentId).sort((a,b) => a.order_rank.localeCompare(b.order_rank));

    // Determine exact placement
    if (isBelow) {
       prevId = overItem.node.id;
       const overSiblingIndex = siblings.findIndex(s => s.id === overItem.node.id);
       nextId = overSiblingIndex < siblings.length - 1 ? siblings[overSiblingIndex + 1].id : null;
    } else {
       nextId = overItem.node.id;
       const overSiblingIndex = siblings.findIndex(s => s.id === overItem.node.id);
       prevId = overSiblingIndex > 0 ? siblings[overSiblingIndex - 1].id : null;
    }

    // Exclude self from calculation if we didn't change parent and were just sliding past
    if (prevId === active.id) prevId = null; // Edge case placeholder
    if (nextId === active.id) nextId = null;

    // Need exact ranks from DB state
    const prevNodeRank = prevId ? nodes.find(n=>n.id === prevId)?.order_rank || null : null;
    const nextNodeRank = nextId ? nodes.find(n=>n.id === nextId)?.order_rank || null : null;

    onReorder(active.id as string, newParentId, prevNodeRank, nextNodeRank, newLevel);
  };

  return (
    <div className="w-full h-full overflow-y-auto p-4 bg-slate-50">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {flattenedNodes.map(({ node, depth }) => (
              <SortableTreeItem
                key={node.id}
                node={node}
                depth={depth}
                isActive={node.id === activeNodeId}
                onSelect={onSelectNode}
                isExpanded={expandedIds.has(node.id)}
                onToggleExpand={toggleExpand}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeDragNode ? (
            <div className="flex items-center gap-2 p-2 rounded-lg border bg-white shadow-xl opacity-90 text-sm">
              <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {activeDragNode.wbs_number}
              </span>
              <span className="font-medium text-slate-800">{activeDragNode.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
