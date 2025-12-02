'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Circle, Plus, Trash2, ExternalLink, Film, BookOpen, Users, Clipboard, Dumbbell, ChevronDown, ChevronRight } from 'lucide-react';
import type { PrepTask, LinkedStation } from '@/lib/services/game-prep-hub.service';
import { completeTask, uncompleteTask, deleteTask, createTask } from '@/lib/services/game-prep-hub.client';

interface PrepChecklistSidebarProps {
  tasks: PrepTask[];
  prepPlanId: string;
  teamId: string;
  gameId: string;
  daysUntilGame: number;
  onTaskUpdate: (task: PrepTask) => void;
  onTaskCreate: (task: PrepTask) => void;
  onTaskDelete: (taskId: string) => void;
}

export default function PrepChecklistSidebar({
  tasks,
  prepPlanId,
  teamId,
  gameId,
  daysUntilGame,
  onTaskUpdate,
  onTaskCreate,
  onTaskDelete
}: PrepChecklistSidebarProps) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStation, setNewTaskStation] = useState<LinkedStation>('game_plan');
  const [newTaskPriority, setNewTaskPriority] = useState<number>(2);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Collapsible states - default collapsed
  const [mustDoExpanded, setMustDoExpanded] = useState(false);
  const [shouldDoExpanded, setShouldDoExpanded] = useState(false);
  const [niceToDoExpanded, setNiceToDoExpanded] = useState(false);

  // Group tasks by priority
  const mustDoTasks = tasks.filter(t => t.priority === 1);
  const shouldDoTasks = tasks.filter(t => t.priority === 2);
  const niceToDoTasks = tasks.filter(t => t.priority === 3);

  // Calculate weighted readiness
  // Must Do: 50%, Should Do: 35%, Nice to Have: 15%
  const mustDoCompleted = mustDoTasks.filter(t => t.is_completed).length;
  const shouldDoCompleted = shouldDoTasks.filter(t => t.is_completed).length;
  const niceToDoCompleted = niceToDoTasks.filter(t => t.is_completed).length;

  const mustDoProgress = mustDoTasks.length > 0 ? mustDoCompleted / mustDoTasks.length : 1;
  const shouldDoProgress = shouldDoTasks.length > 0 ? shouldDoCompleted / shouldDoTasks.length : 1;
  const niceToDoProgress = niceToDoTasks.length > 0 ? niceToDoCompleted / niceToDoTasks.length : 1;

  const weightedReadiness = Math.round(
    mustDoProgress * 50 +
    shouldDoProgress * 35 +
    niceToDoProgress * 15
  );

  // Donut chart calculations - larger size for prominence
  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (weightedReadiness / 100) * circumference;
  const dashArray = `${progress} ${circumference - progress}`;

  // Color based on readiness
  const getColor = () => {
    if (weightedReadiness >= 75) return { fill: '#22c55e', text: 'text-green-600', bg: 'bg-green-50' };
    if (weightedReadiness >= 40) return { fill: '#eab308', text: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (weightedReadiness >= 10) return { fill: '#ef4444', text: 'text-red-600', bg: 'bg-red-50' };
    return { fill: '#9ca3af', text: 'text-gray-500', bg: 'bg-gray-50' };
  };
  const colors = getColor();

  const handleToggleTask = async (task: PrepTask) => {
    setSavingId(task.id);
    try {
      if (task.is_completed) {
        await uncompleteTask(task.id);
        onTaskUpdate({ ...task, is_completed: false, completed_at: null });
      } else {
        await completeTask(task.id);
        onTaskUpdate({ ...task, is_completed: true, completed_at: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setSavingId(taskId);
    try {
      await deleteTask(taskId);
      onTaskDelete(taskId);
    } catch (error) {
      console.error('Failed to delete task:', error);
    } finally {
      setSavingId(null);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      const newTask = await createTask(prepPlanId, newTaskTitle.trim(), newTaskStation, {
        priority: newTaskPriority,
        linkHref: getStationHref(newTaskStation, teamId, gameId)
      });
      onTaskCreate(newTask);
      setNewTaskTitle('');
      setIsAddingTask(false);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  return (
    <div className={`${colors.bg} border border-gray-200 rounded-lg`}>
      {/* Donut Chart Header - Centered and Prominent */}
      <div className="p-5 border-b border-gray-200">
        {/* Days badge */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-gray-900">Game Prep</span>
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
            {daysUntilGame === 0 ? 'Game Day!' :
             daysUntilGame === 1 ? '1 day' :
             `${daysUntilGame} days`}
          </span>
        </div>

        {/* Centered Donut Chart */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <svg width={size} height={size} className="transform -rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={colors.fill}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${colors.text}`}>{weightedReadiness}%</span>
              <span className="text-xs text-gray-500">Ready</span>
            </div>
          </div>
        </div>

        {/* Progress summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/50 rounded-lg py-2 px-1">
            <div className="text-sm font-semibold text-gray-900">{mustDoCompleted}/{mustDoTasks.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Must Do</div>
          </div>
          <div className="bg-white/50 rounded-lg py-2 px-1">
            <div className="text-sm font-semibold text-gray-900">{shouldDoCompleted}/{shouldDoTasks.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Should</div>
          </div>
          <div className="bg-white/50 rounded-lg py-2 px-1">
            <div className="text-sm font-semibold text-gray-900">{niceToDoCompleted}/{niceToDoTasks.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Nice</div>
          </div>
        </div>
      </div>

      {/* Task lists */}
      <div className="divide-y divide-gray-100">
        {mustDoTasks.length > 0 && (
          <TaskGroup
            title="Must Do"
            weight="50%"
            tasks={mustDoTasks}
            savingId={savingId}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            priorityColor="text-red-600"
            isExpanded={mustDoExpanded}
            onToggleExpand={() => setMustDoExpanded(!mustDoExpanded)}
          />
        )}

        {shouldDoTasks.length > 0 && (
          <TaskGroup
            title="Should Do"
            weight="35%"
            tasks={shouldDoTasks}
            savingId={savingId}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            priorityColor="text-yellow-600"
            isExpanded={shouldDoExpanded}
            onToggleExpand={() => setShouldDoExpanded(!shouldDoExpanded)}
          />
        )}

        {niceToDoTasks.length > 0 && (
          <TaskGroup
            title="Nice to Have"
            weight="15%"
            tasks={niceToDoTasks}
            savingId={savingId}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            priorityColor="text-blue-600"
            isExpanded={niceToDoExpanded}
            onToggleExpand={() => setNiceToDoExpanded(!niceToDoExpanded)}
          />
        )}
      </div>

      {/* Add task */}
      <div className="p-3 border-t border-gray-200">
        {isAddingTask ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
                if (e.key === 'Escape') setIsAddingTask(false);
              }}
            />
            <div className="flex gap-2">
              <select
                value={newTaskStation}
                onChange={(e) => setNewTaskStation(e.target.value as LinkedStation)}
                className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-900 bg-white"
              >
                <option value="film_review">Film Review</option>
                <option value="game_plan">Game Plan</option>
                <option value="practice">Practice</option>
                <option value="personnel">Personnel</option>
                <option value="playbook">Playbook</option>
              </select>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(Number(e.target.value))}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-900 bg-white"
              >
                <option value={1}>Must</option>
                <option value={2}>Should</option>
                <option value={3}>Nice</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim()}
                className="flex-1 px-3 py-1.5 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                Add Task
              </button>
              <button
                onClick={() => setIsAddingTask(false)}
                className="px-3 py-1.5 text-gray-600 text-sm rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingTask(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        )}
      </div>
    </div>
  );
}

interface TaskGroupProps {
  title: string;
  weight: string;
  tasks: PrepTask[];
  savingId: string | null;
  onToggle: (task: PrepTask) => void;
  onDelete: (taskId: string) => void;
  priorityColor: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function TaskGroup({ title, weight, tasks, savingId, onToggle, onDelete, priorityColor, isExpanded, onToggleExpand }: TaskGroupProps) {
  const completedCount = tasks.filter(t => t.is_completed).length;
  const allComplete = completedCount === tasks.length;

  return (
    <div className="py-2">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/50 rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <h3 className={`text-xs font-semibold uppercase tracking-wider ${allComplete ? 'text-green-600' : priorityColor}`}>
            {title}
          </h3>
          <span className="text-[10px] text-gray-400">({weight})</span>
        </div>
        <span className={`text-xs ${allComplete ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
          {completedCount}/{tasks.length}
        </span>
      </button>
      {isExpanded && (
        <div className="space-y-0.5 px-3 mt-1">
          {tasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              isSaving={savingId === task.id}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TaskItemProps {
  task: PrepTask;
  isSaving: boolean;
  onToggle: (task: PrepTask) => void;
  onDelete: (taskId: string) => void;
}

function TaskItem({ task, isSaving, onToggle, onDelete }: TaskItemProps) {
  const [showActions, setShowActions] = useState(false);

  const getStationIcon = () => {
    switch (task.linked_station) {
      case 'film_review':
        return <Film className="w-3 h-3" />;
      case 'game_plan':
        return <Clipboard className="w-3 h-3" />;
      case 'practice':
        return <Dumbbell className="w-3 h-3" />;
      case 'personnel':
        return <Users className="w-3 h-3" />;
      case 'playbook':
        return <BookOpen className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div
      className="group flex items-center gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-white/50 transition-colors"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <button
        onClick={() => onToggle(task)}
        disabled={isSaving}
        className="flex-shrink-0 disabled:opacity-50"
      >
        {task.is_completed ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Circle className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        )}
      </button>

      {/* Task title - always clickable if has link */}
      {task.link_href ? (
        <Link href={task.link_href} className="flex-1 min-w-0 flex items-center gap-1.5 group/link">
          <span className={`text-sm truncate ${task.is_completed ? 'text-gray-400 line-through group-hover/link:text-gray-600' : 'text-gray-700 group-hover/link:text-gray-900'}`}>
            {task.title}
          </span>
          <ExternalLink className="w-3 h-3 text-gray-400 group-hover/link:text-gray-600 flex-shrink-0" />
        </Link>
      ) : (
        <span className={`flex-1 min-w-0 text-sm truncate ${task.is_completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
          {task.title}
        </span>
      )}

      {/* Station icon */}
      <span className="text-gray-400 flex-shrink-0" title={task.linked_station}>
        {getStationIcon()}
      </span>

      {/* Delete button for manual tasks */}
      {task.source_type === 'manual' && (
        <button
          onClick={() => onDelete(task.id)}
          disabled={isSaving}
          className={`p-0.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}
          title="Delete task"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function getStationHref(station: LinkedStation, teamId: string, gameId: string): string {
  switch (station) {
    case 'film_review':
      return `/teams/${teamId}/film`;
    case 'game_plan':
      return `/teams/${teamId}/game-week/game-plan/${gameId}`;
    case 'practice':
      return `/teams/${teamId}/practice`;
    case 'personnel':
      return `/teams/${teamId}/players`;
    case 'playbook':
      return `/teams/${teamId}/playbook`;
    default:
      return `/teams/${teamId}`;
  }
}
