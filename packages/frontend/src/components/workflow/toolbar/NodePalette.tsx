import type { DragEvent } from 'react';
import type { NodeType } from '@/types/workflow';
import { Bot, User, Code2 } from 'lucide-react';

interface NodeTypeInfo {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const NODE_TYPES: NodeTypeInfo[] = [
  {
    type: 'agent',
    label: 'Agent',
    icon: <Bot className="w-5 h-5" />,
    description: 'Execute an AI agent step',
  },
  {
    type: 'human-gate',
    label: 'Human Gate',
    icon: <User className="w-5 h-5" />,
    description: 'Pause for human review',
  },
  {
    type: 'code-review',
    label: 'Code Review',
    icon: <Code2 className="w-5 h-5" />,
    description: 'Review with commands',
  },
];

export function NodePalette() {
  const onDragStart = (event: DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-60 border-r border-gray-200 p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
        Add Node
      </h3>
      <div className="space-y-2">
        {NODE_TYPES.map(({ type, label, icon, description }) => (
          <div
            key={type}
            className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-grab hover:shadow-md transition-shadow"
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            data-testid={`palette-item-${type}`}
          >
            <span className="text-gray-600 flex-shrink-0">{icon}</span>
            <div className="min-w-0">
              <span className="block text-sm font-medium text-gray-800">
                {label}
              </span>
              <span className="block text-xs text-gray-500 truncate">
                {description}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
