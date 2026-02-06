'use client';

import {
  MousePointer2,
  TrendingUp,
  Shield,
  MoveHorizontal,
  Circle,
  Zap,
  Eraser,
  Undo2,
  Redo2,
} from 'lucide-react';
import { QUICK_DRAW_TOOLS, type QuickDrawToolId } from './fieldConstants';

interface QuickDrawToolbarProps {
  selectedTool: QuickDrawToolId;
  onSelectTool: (tool: QuickDrawToolId) => void;
  odk: 'offense' | 'defense' | 'specialTeams';
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

// Map tool icon names to actual Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MousePointer2,
  TrendingUp,
  Shield,
  MoveHorizontal,
  Circle,
  Zap,
  Eraser,
};

export default function QuickDrawToolbar({
  selectedTool,
  onSelectTool,
  odk,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: QuickDrawToolbarProps) {
  // Filter tools based on ODK (offense/defense/specialTeams)
  const availableTools = QUICK_DRAW_TOOLS.filter((tool) => {
    if (tool.side === 'both') return true;
    if (odk === 'offense' || odk === 'specialTeams') return tool.side === 'offense';
    if (odk === 'defense') return tool.side === 'defense';
    return false;
  });

  return (
    <div className="flex items-center justify-center gap-1 bg-gray-800 rounded-lg p-2 shadow-lg">
      {/* Undo/Redo buttons */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-600">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-md transition-colors ${
            canUndo
              ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-5 h-5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-md transition-colors ${
            canRedo
              ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-5 h-5" />
        </button>
      </div>

      {/* Tool buttons */}
      <div className="flex items-center gap-1 pl-2">
        {availableTools.map((tool) => {
          const IconComponent = iconMap[tool.icon];
          const isSelected = selectedTool === tool.id;

          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isSelected
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              title={tool.description}
            >
              {IconComponent && <IconComponent className="w-5 h-5" />}
              <span className="text-sm font-medium hidden sm:inline">{tool.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
