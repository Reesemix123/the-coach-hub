// src/components/PracticeTimeline.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';

export interface TimelinePeriod {
  id: string;
  name: string;
  duration_minutes: number;
  start_time: number | null;
  is_concurrent?: boolean;
  period_type?: string;
  assigned_coach_id?: string;
}

export interface TimelineCoach {
  id: string;
  name: string;
  isGuest?: boolean;
}

interface PracticeTimelineProps {
  periods: TimelinePeriod[];
  totalDuration?: number;
  coaches?: TimelineCoach[];
  onPeriodReassign?: (periodId: string, newCoachId: string) => void;
  onPeriodsSwap?: (period1Id: string, coach1Id: string, period2Id: string, coach2Id: string) => void;
  onBatchReassign?: (reassignments: Array<{ periodId: string; newCoachId: string }>) => void;
  editable?: boolean;
  // External trigger to open reassign modal for a specific period (from period card)
  externalSelectedPeriodId?: string | null;
  onModalClosed?: () => void;
}

interface PendingReassignment {
  periodId: string;
  periodName: string;
  fromCoachId: string;
  fromCoachName: string;
}

export default function PracticeTimeline({
  periods,
  totalDuration,
  coaches,
  onPeriodReassign,
  onPeriodsSwap,
  onBatchReassign,
  editable = false,
  externalSelectedPeriodId,
  onModalClosed
}: PracticeTimelineProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimelinePeriod | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  // For chain reassignment - tracks all reassignments being made
  const [reassignmentChain, setReassignmentChain] = useState<Array<{ periodId: string; newCoachId: string }>>([]);
  // Track which period is being displaced and needs reassignment
  const [displacedPeriod, setDisplacedPeriod] = useState<PendingReassignment | null>(null);

  // Handle external trigger to open modal for a specific period (from period card)
  useEffect(() => {
    if (externalSelectedPeriodId) {
      const period = periods.find(p => p.id === externalSelectedPeriodId);
      if (period && period.is_concurrent) {
        setSelectedPeriod(period);
        setShowReassignModal(true);
      }
    }
  }, [externalSelectedPeriodId, periods]);

  if (periods.length === 0) {
    return null;
  }

  // Calculate positions for each period
  const periodsWithPositions = periods.map((period, index) => {
    let startTime = period.start_time;

    // If start_time is null, calculate sequential position
    if (startTime === null) {
      startTime = 0;
      for (let i = 0; i < index; i++) {
        const prevPeriod = periods[i];
        // Only count non-concurrent periods or the first of concurrent group
        if (!prevPeriod.is_concurrent || (prevPeriod.start_time !== null)) {
          const prevStart = prevPeriod.start_time ?? 0;
          startTime = Math.max(startTime, prevStart + prevPeriod.duration_minutes);
        }
      }
    }

    return {
      ...period,
      calculatedStart: startTime,
      calculatedEnd: startTime + period.duration_minutes
    };
  });

  // Group concurrent periods that happen at the same time
  const concurrentGroups: Map<number, typeof periodsWithPositions[0][]> = new Map();
  const nonConcurrentPeriods: typeof periodsWithPositions[0][] = [];

  periodsWithPositions.forEach(period => {
    if (period.is_concurrent) {
      const startKey = period.calculatedStart;
      if (!concurrentGroups.has(startKey)) {
        concurrentGroups.set(startKey, []);
      }
      concurrentGroups.get(startKey)!.push(period);
    } else {
      nonConcurrentPeriods.push(period);
    }
  });

  // Determine number of swim lanes based on coaches or max concurrent periods
  const maxConcurrent = Math.max(
    ...Array.from(concurrentGroups.values()).map(g => g.length),
    1
  );
  const numLanes = coaches && coaches.length > 0
    ? coaches.length
    : Math.max(maxConcurrent, 2);

  // Calculate actual timeline duration (non-concurrent periods only)
  let actualDuration = 0;

  // Sort all periods by start time
  const sortedPeriods = [...periodsWithPositions].sort((a, b) => a.calculatedStart - b.calculatedStart);

  // Track which time slots have been counted
  const processedTimes = new Set<number>();

  sortedPeriods.forEach(period => {
    if (!processedTimes.has(period.calculatedStart)) {
      actualDuration += period.duration_minutes;
      processedTimes.add(period.calculatedStart);
    }
  });

  // Use actual duration or provided total
  const maxEndTime = totalDuration || actualDuration || Math.max(
    ...periodsWithPositions.map(p => p.calculatedEnd)
  );

  // Color mapping for period types
  const getColor = (type?: string) => {
    switch (type) {
      case 'warmup': return 'bg-yellow-400 border-yellow-600';
      case 'drill': return 'bg-blue-400 border-blue-600';
      case 'team': return 'bg-purple-400 border-purple-600';
      case 'special_teams': return 'bg-green-400 border-green-600';
      case 'conditioning': return 'bg-red-400 border-red-600';
      default: return 'bg-gray-400 border-gray-600';
    }
  };

  // Create swim lane labels - use actual coach names if provided
  const laneLabels = coaches && coaches.length > 0
    ? coaches.map(c => ({ id: c.id, name: c.name, isGuest: c.isGuest }))
    : Array.from({ length: numLanes }, (_, i) => ({
        id: `coach-${i + 1}`,
        name: `Coach ${i + 1}`,
        isGuest: false
      }));

  // Get coach name by id or index
  const getCoachName = (coachId?: string, index?: number): string => {
    if (coachId) {
      const lane = laneLabels.find(l => l.id === coachId);
      if (lane) return lane.name;
    }
    if (typeof index === 'number' && laneLabels[index]) {
      return laneLabels[index].name;
    }
    return 'Coach';
  };

  // Get lane index for a coach ID
  const getLaneIndex = (coachId?: string, fallbackIndex?: number): number => {
    if (coachId) {
      const idx = laneLabels.findIndex(l => l.id === coachId);
      if (idx !== -1) return idx;
    }
    return fallbackIndex ?? 0;
  };

  // Handle period click for reassignment
  const handlePeriodClick = (period: typeof periodsWithPositions[0]) => {
    if (!editable || !period.is_concurrent || !onPeriodReassign) return;
    setSelectedPeriod(period);
    setShowReassignModal(true);
  };

  // Helper to get coach ID for a period (either assigned or by index in concurrent group)
  const getCoachIdForPeriod = (period: typeof periodsWithPositions[0]): string => {
    if (period.assigned_coach_id) return period.assigned_coach_id;
    // Find index in concurrent group
    const group = Array.from(concurrentGroups.values()).find(g => g.some(p => p.id === period.id));
    if (group) {
      const idx = group.findIndex(p => p.id === period.id);
      if (idx !== -1 && laneLabels[idx]) return laneLabels[idx].id;
    }
    return laneLabels[0]?.id || '';
  };

  // Find conflicting period at a time slot for a coach
  const findConflictingPeriod = (
    timeSlot: number,
    targetCoachId: string,
    excludePeriodIds: string[]
  ): typeof periodsWithPositions[0] | undefined => {
    return periodsWithPositions.find(p =>
      !excludePeriodIds.includes(p.id) &&
      p.is_concurrent &&
      p.calculatedStart === timeSlot &&
      getCoachIdForPeriod(p) === targetCoachId
    );
  };

  // Handle coach selection in modal (supports chain reassignment)
  const handleCoachSelect = (coachId: string) => {
    const currentPeriod = displacedPeriod
      ? periodsWithPositions.find(p => p.id === displacedPeriod.periodId)
      : selectedPeriod ? periodsWithPositions.find(p => p.id === selectedPeriod.id) : null;

    if (!currentPeriod) return;

    const timeSlot = currentPeriod.calculatedStart;
    const alreadyReassignedIds = reassignmentChain.map(r => r.periodId);

    // Check if target coach already has a period at this time (excluding already reassigned)
    const conflictingPeriod = findConflictingPeriod(timeSlot, coachId, [...alreadyReassignedIds, currentPeriod.id]);

    // Add current reassignment to chain
    const newChain = [...reassignmentChain, { periodId: currentPeriod.id, newCoachId: coachId }];
    setReassignmentChain(newChain);

    if (conflictingPeriod) {
      // There's a conflict - need to reassign the conflicting period
      const conflictCoachName = getCoachName(coachId);
      setDisplacedPeriod({
        periodId: conflictingPeriod.id,
        periodName: conflictingPeriod.name,
        fromCoachId: coachId,
        fromCoachName: conflictCoachName,
      });
    } else {
      // No conflict - apply all reassignments
      if (onBatchReassign) {
        onBatchReassign(newChain);
      } else if (onPeriodReassign) {
        // Fallback: apply one by one
        newChain.forEach(r => onPeriodReassign(r.periodId, r.newCoachId));
      }
      // Reset state
      setShowReassignModal(false);
      setSelectedPeriod(null);
      setDisplacedPeriod(null);
      setReassignmentChain([]);
      // Notify parent that modal was closed (for external triggers)
      onModalClosed?.();
    }
  };

  // Cancel and reset the modal
  const handleCancelReassign = () => {
    setShowReassignModal(false);
    setSelectedPeriod(null);
    setDisplacedPeriod(null);
    setReassignmentChain([]);
    // Notify parent that modal was closed (for external triggers)
    onModalClosed?.();
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Timeline</h3>
          <span className="text-xs sm:text-sm text-gray-600">({actualDuration} min)</span>
          {editable && onPeriodReassign && (
            <span className="hidden sm:inline ml-auto text-xs text-gray-500">Click parallel drills to reassign coaches</span>
          )}
        </div>

        {/* Timeline */}
        <div className="relative min-w-0">
          {/* Time markers */}
          <div className="flex justify-between text-xs text-gray-500 mb-2 ml-16 sm:ml-24">
            <span>0</span>
            <span className="hidden sm:inline">{Math.floor(maxEndTime / 2)}m</span>
            <span>{maxEndTime}m</span>
          </div>

          {/* Swim lanes */}
          <div className="flex">
            {/* Lane labels */}
            <div className="w-16 sm:w-24 flex-shrink-0">
              {laneLabels.map((lane, i) => (
                <div key={lane.id} className="h-10 sm:h-14 flex items-center justify-end pr-2 sm:pr-3">
                  <div className="text-right">
                    <span className="text-xs font-medium text-gray-700 block truncate max-w-14 sm:max-w-20">
                      {lane.name}
                    </span>
                    {lane.isGuest && (
                      <span className="text-xs text-gray-400 hidden sm:inline">(Guest)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline area */}
            <div className="flex-1 relative">
              {laneLabels.map((_, laneIndex) => (
                <div
                  key={laneIndex}
                  className={`h-10 sm:h-14 bg-gray-50 border-x border-gray-200 ${laneIndex === 0 ? 'border-t rounded-t' : ''} ${laneIndex === numLanes - 1 ? 'border-b rounded-b' : 'border-b border-dashed'}`}
                />
              ))}

              {/* Render non-concurrent periods spanning all lanes */}
              {nonConcurrentPeriods.map(period => {
                const leftPercent = (period.calculatedStart / maxEndTime) * 100;
                const widthPercent = (period.duration_minutes / maxEndTime) * 100;
                const totalHeight = numLanes * 56; // 14px * 4 (h-14 = 3.5rem = 56px)

                return (
                  <div
                    key={period.id}
                    className={`absolute ${getColor(period.period_type)} rounded shadow border-2 overflow-hidden z-10`}
                    style={{
                      left: `${leftPercent}%`,
                      width: `${Math.max(widthPercent, 3)}%`,
                      top: '4px',
                      height: `${totalHeight - 8}px`
                    }}
                  >
                    <div className="px-2 py-1 h-full flex flex-col justify-center">
                      <div className="text-xs font-semibold text-white truncate">
                        {period.name}
                      </div>
                      <div className="text-xs text-white/90">
                        {period.duration_minutes}m • All coaches
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Render concurrent periods in their assigned lanes */}
              {Array.from(concurrentGroups.entries()).map(([startTime, groupPeriods]) => {
                return groupPeriods.map((period, periodIndex) => {
                  const leftPercent = (period.calculatedStart / maxEndTime) * 100;
                  const widthPercent = (period.duration_minutes / maxEndTime) * 100;
                  const laneHeight = 56; // h-14 = 3.5rem = 56px
                  // Use assigned coach's lane, or fallback to index
                  const laneIndex = getLaneIndex(period.assigned_coach_id, periodIndex);
                  const topOffset = laneIndex * laneHeight + 4;
                  const coachName = getCoachName(period.assigned_coach_id, periodIndex);
                  const isClickable = editable && onPeriodReassign;

                  return (
                    <div
                      key={period.id}
                      onClick={() => handlePeriodClick(period)}
                      className={`absolute ${getColor(period.period_type)} rounded shadow border-2 overflow-hidden z-10 ${
                        isClickable ? 'cursor-pointer hover:ring-2 hover:ring-white hover:ring-offset-2 transition-all' : ''
                      }`}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${Math.max(widthPercent, 3)}%`,
                        top: `${topOffset}px`,
                        height: `${laneHeight - 8}px`
                      }}
                    >
                      <div className="px-2 py-1 h-full flex flex-col justify-center">
                        <div className="text-xs font-semibold text-white truncate">
                          {period.name}
                        </div>
                        <div className="text-xs text-white/90">
                          {period.duration_minutes}m • {coachName}
                        </div>
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-yellow-400 border border-yellow-600 rounded"></div>
              <span className="text-gray-600">Warmup</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-400 border border-blue-600 rounded"></div>
              <span className="text-gray-600">Drill</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-400 border border-purple-600 rounded"></div>
              <span className="text-gray-600">Team</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 border border-green-600 rounded"></div>
              <span className="text-gray-600 hidden sm:inline">Special Teams</span>
              <span className="text-gray-600 sm:hidden">ST</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-400 border border-red-600 rounded"></div>
              <span className="text-gray-600">Cond.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reassign Modal */}
      {showReassignModal && (selectedPeriod || displacedPeriod) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  {displacedPeriod ? 'Reassign Displaced Activity' : 'Reassign Activity'}
                </h3>
                <button
                  onClick={handleCancelReassign}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5">
              {/* Show chain progress if we have reassignments queued */}
              {reassignmentChain.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-medium text-amber-800 mb-2">Reassignment chain:</p>
                  <div className="space-y-1">
                    {reassignmentChain.map((r, idx) => {
                      const period = periodsWithPositions.find(p => p.id === r.periodId);
                      const coachName = laneLabels.find(l => l.id === r.newCoachId)?.name || 'Unknown';
                      return (
                        <div key={idx} className="text-xs text-amber-700 flex items-center gap-1">
                          <span className="font-medium">{period?.name}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span>{coachName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Current activity being reassigned */}
              {displacedPeriod ? (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">{displacedPeriod.fromCoachName}</span> already has an activity.
                      Where should this activity go?
                    </p>
                    {(() => {
                      const period = periodsWithPositions.find(p => p.id === displacedPeriod.periodId);
                      return period ? (
                        <div className={`${getColor(period.period_type)} rounded-lg px-4 py-3 text-white`}>
                          <div className="font-semibold">{period.name}</div>
                          <div className="text-sm text-white/90">
                            {period.duration_minutes} min • Currently: {displacedPeriod.fromCoachName}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </>
              ) : selectedPeriod && (
                <>
                  <div className="mb-4">
                    <div className={`${getColor(selectedPeriod.period_type)} rounded-lg px-4 py-3 text-white`}>
                      <div className="font-semibold">{selectedPeriod.name}</div>
                      <div className="text-sm text-white/90">
                        {selectedPeriod.duration_minutes} min • Currently: {getCoachName(selectedPeriod.assigned_coach_id)}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Select which coach should run this activity:
                  </p>
                </>
              )}

              {/* Coach selection buttons */}
              <div className="space-y-2">
                {laneLabels.map((lane) => {
                  const currentPeriodId = displacedPeriod?.periodId || selectedPeriod?.id;
                  const currentPeriod = periodsWithPositions.find(p => p.id === currentPeriodId);
                  const currentCoachId = currentPeriod ? getCoachIdForPeriod(currentPeriod) : '';
                  const isCurrentCoach = lane.id === currentCoachId;
                  // Also disable coaches who are already in the reassignment chain
                  const isInChain = reassignmentChain.some(r => r.newCoachId === lane.id);

                  return (
                    <button
                      key={lane.id}
                      onClick={() => handleCoachSelect(lane.id)}
                      disabled={isCurrentCoach}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                        isCurrentCoach
                          ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                          : isInChain
                          ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                          : 'bg-white border-gray-200 hover:bg-emerald-50 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCurrentCoach ? 'bg-gray-200' : isInChain ? 'bg-amber-100' : 'bg-emerald-100'
                        }`}>
                          <span className={`text-sm font-medium ${
                            isCurrentCoach ? 'text-gray-400' : isInChain ? 'text-amber-700' : 'text-emerald-700'
                          }`}>
                            {lane.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="text-left">
                          <span className={`font-medium ${isCurrentCoach ? 'text-gray-400' : 'text-gray-900'}`}>
                            {lane.name}
                          </span>
                          {lane.isGuest && (
                            <span className="ml-2 text-xs text-gray-400">(Guest)</span>
                          )}
                          {isCurrentCoach && (
                            <span className="ml-2 text-xs text-gray-400">(Current)</span>
                          )}
                          {isInChain && !isCurrentCoach && (
                            <span className="ml-2 text-xs text-amber-600">(will swap)</span>
                          )}
                        </div>
                      </div>
                      {!isCurrentCoach && (
                        <ArrowRight className={`h-4 w-4 ${isInChain ? 'text-amber-600' : 'text-emerald-600'}`} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tip for multi-coach chains */}
              {displacedPeriod && (
                <p className="mt-4 text-xs text-gray-500">
                  Tip: Select a coach without an activity to complete the chain, or continue swapping.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
