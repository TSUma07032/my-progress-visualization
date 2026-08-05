import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WbsNodeWithNumber } from '../lib/types';
import { ChevronRight, ChevronDown, CheckCircle2, Circle, PlayCircle } from 'lucide-react';

interface SortableTreeItemProps {
  node: WbsNodeWithNumber;
  depth: number;
  isActive: boolean;
  onSelect: (node: WbsNodeWithNumber) => void;
  isExpanded: boolean;
  onToggleExpand: (nodeId: string) => void;
}

export function SortableTreeItem({
  node,
  depth,
  isActive,
  onSelect,
  isExpanded,
  onToggleExpand
}: SortableTreeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id, data: { node } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${depth * 20 + 8}px`,
  };

  const hasChildren = node.children && node.children.length > 0;

  const StatusIcon = () => {
    switch (node.status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'in_progress': return <PlayCircle className="w-4 h-4 text-blue-500" />;
      default: return <Circle className="w-4 h-4 text-slate-300" />;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 p-2 mb-1 rounded-lg border text-sm transition-colors cursor-pointer
        ${isDragging ? 'opacity-50 bg-slate-100 z-50' : 'bg-white'}
        ${isActive ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}
      `}
      onClick={() => onSelect(node)}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 px-1"
      >
        ⋮⋮
      </div>

      <div
        className="w-5 h-5 flex items-center justify-center cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) onToggleExpand(node.id);
        }}
      >
        {hasChildren ? (
          isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />
        ) : <div className="w-4 h-4" />}
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          {node.wbs_number}
        </span>
        <StatusIcon />
        <span className="font-medium text-slate-800 truncate">{node.title}</span>
      </div>
    </div>
  );
}
