'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Trash2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  GamePlanPlayWithDetails,
  PlayRelationshipWithDetails,
  SituationalCategoryId
} from '@/types/football';
import type { GamePlanSide } from '@/lib/services/game-plan.service';
import {
  getSituationalCategories,
  getPlayTypeCategories,
  getSituationGroups,
  type SituationGroup
} from '@/config/gamePlanCategories';

interface SituationAccordionProps {
  playsBySituation: Record<string, GamePlanPlayWithDetails[]>;
  activeSide: GamePlanSide;
  onRemovePlay: (playCode: string, situation: string) => void;
  onReorderPlays?: (situation: string, reorderedPlays: GamePlanPlayWithDetails[]) => void;
  setupCounterRelationships: PlayRelationshipWithDetails[];
  activeSituation: SituationalCategoryId | null;
  onSituationSelect: (situation: SituationalCategoryId | null) => void;
}

// Get default expanded group based on side
function getDefaultExpandedGroup(side: GamePlanSide): string {
  if (side === 'offense') return '1st_down_group';
  if (side === 'defense') return 'def_1st_down_group';
  return 'kickoff_group'; // Special teams default
}

// Get short label for distance based on situation context
function getDistanceLabel(situationId: string): string | null {
  // Skip special teams situations - use full label from config
  if (situationId.startsWith('st_')) return null;

  // 1st down has different distance ranges
  if (situationId.includes('1st_short') || situationId.includes('def_1st_short')) return 'Short (1-5)';
  if (situationId.includes('1st_medium') || situationId.includes('def_1st_medium')) return 'Medium (6-10)';
  if (situationId.includes('1st_long') || situationId.includes('def_1st_long')) return 'Long (11+)';

  // 4th down has different distance ranges
  if (situationId.includes('4th_short') || situationId.includes('def_4th_short')) return 'Short (1-2)';
  if (situationId.includes('4th_medium') || situationId.includes('def_4th_medium')) return 'Medium (3-5)';
  if (situationId.includes('4th_long') || situationId.includes('def_4th_long')) return 'Long (6+)';

  // 2nd and 3rd down standard ranges
  if (situationId.includes('short')) return 'Short (1-3)';
  if (situationId.includes('medium')) return 'Medium (4-6)';
  if (situationId.includes('long')) return 'Long (7+)';

  // Special situations
  if (situationId.includes('red_zone')) return 'Red Zone';
  if (situationId.includes('goal_line')) return 'Goal Line';
  if (situationId.includes('2_minute')) return '2-Minute';
  if (situationId.includes('backed_up')) return 'Backed Up';
  if (situationId.includes('first_15')) return 'First 15 Plays';

  return null;
}

// Sortable Play Item Component
interface SortablePlayItemProps {
  gamePlanPlay: GamePlanPlayWithDetails;
  situationId: string;
  onRemove: (playCode: string, situation: string) => void;
}

function SortablePlayItem({ gamePlanPlay, situationId, onRemove }: SortablePlayItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: gamePlanPlay.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-2 bg-white border border-gray-200 rounded group ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-gray-500 w-6">
          {gamePlanPlay.call_number}
        </span>
        <div className="min-w-0">
          <span className="text-sm font-medium text-gray-900">
            {gamePlanPlay.play_code}
          </span>
          {gamePlanPlay.play && (
            <span className="text-sm text-gray-600 ml-2 truncate">
              {gamePlanPlay.play.play_name}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onRemove(gamePlanPlay.play_code, situationId)}
        className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove from game plan"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function SituationAccordion({
  playsBySituation,
  activeSide,
  onRemovePlay,
  onReorderPlays,
  setupCounterRelationships,
  activeSituation,
  onSituationSelect
}: SituationAccordionProps) {
  // Get dynamic categories based on active side
  const situationalCategories = getSituationalCategories(activeSide);
  const playTypeCategories = getPlayTypeCategories(activeSide);
  const situationGroups = getSituationGroups(activeSide);

  // Track which group is expanded
  const [expandedGroup, setExpandedGroup] = useState<string | null>(
    getDefaultExpandedGroup(activeSide)
  );

  // Reset expanded group when side changes
  useEffect(() => {
    setExpandedGroup(getDefaultExpandedGroup(activeSide));
  }, [activeSide]);

  // DnD sensors with activation constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroup(prev => prev === groupId ? null : groupId);
  };

  const handleSituationClick = (situationId: SituationalCategoryId) => {
    if (activeSituation === situationId) {
      onSituationSelect(null);
    } else {
      onSituationSelect(situationId);
    }
  };

  // Handle drag end for reordering
  const handleDragEnd = (event: DragEndEvent, situationId: string, plays: GamePlanPlayWithDetails[]) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = plays.findIndex(p => p.id === active.id);
      const newIndex = plays.findIndex(p => p.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedPlays = arrayMove(plays, oldIndex, newIndex);

        // Update sort_order values
        const updatedPlays = reorderedPlays.map((play, index) => ({
          ...play,
          sort_order: index + 1
        }));

        if (onReorderPlays) {
          onReorderPlays(situationId, updatedPlays);
        }
      }
    }
  };

  // Group plays by play type within each situation
  const groupByPlayType = (plays: GamePlanPlayWithDetails[]) => {
    const groups: Record<string, GamePlanPlayWithDetails[]> = {};
    for (const play of plays) {
      const type = play.play_type_category || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(play);
    }
    return groups;
  };

  // Get total plays for a group
  const getGroupPlayCount = (group: SituationGroup): number => {
    return group.situations.reduce((sum, sitId) => {
      return sum + (playsBySituation[sitId]?.length || 0);
    }, 0);
  };

  // Get situation category by ID
  const getSituationById = (id: string) => {
    return situationalCategories.find(s => s.id === id);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {activeSide === 'offense' ? 'Offensive' : activeSide === 'defense' ? 'Defensive' : 'Special Teams'} Game Plan
        </h2>
        <p className="text-sm text-gray-600">
          {activeSide === 'special_teams'
            ? 'Add plays to your game plan. Select a situation to see matching plays.'
            : 'Add plays to your game plan. Probability of success %\'s update based on down and distance selected.'}
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {situationGroups.map(group => {
          const isGroupExpanded = expandedGroup === group.id;
          const groupPlayCount = getGroupPlayCount(group);
          const hasSingleSituation = group.situations.length === 1;

          return (
            <div key={group.id}>
              {/* Group Header */}
              <button
                onClick={() => {
                  toggleGroup(group.id);
                  // If single situation group, also select it
                  if (hasSingleSituation) {
                    handleSituationClick(group.situations[0] as SituationalCategoryId);
                  }
                }}
                className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                  isGroupExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isGroupExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <div>
                    <span className="font-semibold text-gray-900">{group.label}</span>
                    <span className="ml-2 text-sm text-gray-500">
                      ({groupPlayCount} {groupPlayCount === 1 ? 'play' : 'plays'})
                    </span>
                  </div>
                </div>
                {hasSingleSituation && activeSituation === group.situations[0] && (
                  <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded">SELECTED</span>
                )}
              </button>

              {/* Expanded Group Content */}
              {isGroupExpanded && (
                <div className="bg-gray-50 border-t border-gray-100">
                  {group.situations.map((situationId, index) => {
                    const situation = getSituationById(situationId);
                    if (!situation) return null;

                    const plays = playsBySituation[situationId] || [];
                    const isActive = activeSituation === situationId;
                    const playGroups = groupByPlayType(plays);
                    const distanceLabel = getDistanceLabel(situationId);

                    return (
                      <div key={situationId} className={index > 0 ? 'border-t border-gray-200' : ''}>
                        {/* Situation Sub-header (only show for multi-situation groups) */}
                        {!hasSingleSituation && (
                          <button
                            onClick={() => handleSituationClick(situationId as SituationalCategoryId)}
                            className={`w-full flex items-center justify-between px-4 py-3 pl-12 text-left transition-colors ${
                              isActive
                                ? 'bg-blue-50 border-l-4 border-blue-500'
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isActive ? 'text-blue-900' : 'text-gray-700'}`}>
                                {distanceLabel || situation.label}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({plays.length})
                              </span>
                            </div>
                            {isActive && (
                              <span className="text-xs text-blue-600 font-medium px-2 py-0.5 bg-blue-100 rounded">SELECTED</span>
                            )}
                          </button>
                        )}

                        {/* Plays Content - Always show for single situation groups when expanded */}
                        {(hasSingleSituation || isActive) && (
                          <div className={`px-4 pb-4 pt-2 ${hasSingleSituation ? '' : 'pl-12'}`}>
                            {plays.length === 0 ? (
                              <p className="text-sm text-gray-500 py-2">
                                No plays added yet. Browse plays on the left to add.
                              </p>
                            ) : (
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(event) => handleDragEnd(event, situationId, plays)}
                              >
                                <div className="space-y-3">
                                  {playTypeCategories.map(playType => {
                                    const typePlays = playGroups[playType.id];
                                    if (!typePlays || typePlays.length === 0) return null;

                                    return (
                                      <div key={playType.id}>
                                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
                                          {playType.label}
                                        </h4>
                                        <SortableContext
                                          items={typePlays.map(p => p.id)}
                                          strategy={verticalListSortingStrategy}
                                        >
                                          <div className="space-y-1">
                                            {typePlays.map(gamePlanPlay => (
                                              <SortablePlayItem
                                                key={gamePlanPlay.id}
                                                gamePlanPlay={gamePlanPlay}
                                                situationId={situationId}
                                                onRemove={onRemovePlay}
                                              />
                                            ))}
                                          </div>
                                        </SortableContext>
                                      </div>
                                    );
                                  })}

                                  {/* Other plays (unassigned play type) */}
                                  {playGroups['other'] && playGroups['other'].length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
                                        Other
                                      </h4>
                                      <SortableContext
                                        items={playGroups['other'].map(p => p.id)}
                                        strategy={verticalListSortingStrategy}
                                      >
                                        <div className="space-y-1">
                                          {playGroups['other'].map(gamePlanPlay => (
                                            <SortablePlayItem
                                              key={gamePlanPlay.id}
                                              gamePlanPlay={gamePlanPlay}
                                              situationId={situationId}
                                              onRemove={onRemovePlay}
                                            />
                                          ))}
                                        </div>
                                      </SortableContext>
                                    </div>
                                  )}
                                </div>
                              </DndContext>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
