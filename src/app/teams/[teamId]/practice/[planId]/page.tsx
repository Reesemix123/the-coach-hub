// src/app/teams/[teamId]/practice/[planId]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import TeamNavigation from '@/components/TeamNavigation';
import PracticeTimeline, { TimelineCoach } from '@/components/PracticeTimeline';
import type { PracticePlanWithDetails, PracticePeriodWithDrills } from '@/types/football';

interface Team {
  id: string;
  name: string;
  level: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
}

interface Coach {
  id: string;
  name: string;
  role: string;
}

export default function PracticePlanDetailPage({
  params
}: {
  params: Promise<{ teamId: string; planId: string }>
}) {
  const { teamId, planId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [practice, setPractice] = useState<PracticePlanWithDetails | null>(null);
  const [coaches, setCoaches] = useState<TimelineCoach[]>([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [teamId, planId]);

  async function fetchData() {
    try {
      // Fetch team
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      setTeam(teamData);

      // Fetch practice plan
      const { data: practiceData } = await supabase
        .from('practice_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (!practiceData) {
        setLoading(false);
        return;
      }

      // Load stored coaches from practice plan, or fallback to team coaches API
      if (practiceData.selected_coaches && practiceData.selected_coaches.length > 0) {
        setCoaches(practiceData.selected_coaches);
      } else {
        // Fallback: fetch from team membership API for older plans
        try {
          const response = await fetch(`/api/teams/${teamId}/coaches`);
          if (response.ok) {
            const data = await response.json();
            setCoaches(data.coaches || []);
          }
        } catch (coachError) {
          console.error('Error fetching coaches:', coachError);
        }
      }

      // Fetch periods
      const { data: periodsData } = await supabase
        .from('practice_periods')
        .select('*')
        .eq('practice_plan_id', planId)
        .order('period_order');

      // Fetch drills for each period
      const periodsWithDrills: PracticePeriodWithDrills[] = [];

      if (periodsData) {
        for (const period of periodsData) {
          const { data: drillsData } = await supabase
            .from('practice_drills')
            .select('*')
            .eq('period_id', period.id)
            .order('drill_order');

          periodsWithDrills.push({
            ...period,
            drills: drillsData || []
          });
        }
      }

      setPractice({
        ...practiceData,
        periods: periodsWithDrills
      });

    } catch (error) {
      console.error('Error fetching practice plan:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading practice plan...</div>
      </div>
    );
  }

  if (!team || !practice) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">Practice plan not found</div>
          <button
            onClick={() => router.push(`/teams/${teamId}/practice`)}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Back to Practice Plans
          </button>
        </div>
      </div>
    );
  }

  // Calculate actual practice duration (accounting for concurrent activities)
  const calculateActualDuration = () => {
    const periods = practice.periods;
    // Group periods by start_time for concurrent periods
    const nonConcurrent = periods.filter(p => !p.is_concurrent);
    const concurrent = periods.filter(p => p.is_concurrent);

    // Sum non-concurrent periods normally
    let total = nonConcurrent.reduce((sum, p) => sum + p.duration_minutes, 0);

    // Group concurrent periods by start_time and only count max duration per group
    const concurrentGroups = new Map<number, number>();
    concurrent.forEach(p => {
      const startTime = p.start_time ?? 0;
      const currentMax = concurrentGroups.get(startTime) ?? 0;
      concurrentGroups.set(startTime, Math.max(currentMax, p.duration_minutes));
    });

    // Add max duration from each concurrent group
    concurrentGroups.forEach(maxDuration => {
      total += maxDuration;
    });

    return total;
  };

  const totalMinutes = calculateActualDuration();

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Navigation */}
      <TeamNavigation
        team={team}
        teamId={teamId}
        currentPage="practice"
      />

      {/* Practice Plan Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{practice.title}</h1>
              {practice.is_template && (
                <span className="px-3 py-1 text-sm font-medium rounded bg-purple-100 text-purple-700 border border-purple-200">
                  Template
                </span>
              )}
            </div>
            <div className="flex items-center gap-6 text-gray-600">
              <span>📅 {new Date(practice.date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}</span>
              <span>⏱️ {totalMinutes} min total</span>
              {practice.location && <span>📍 {practice.location}</span>}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/teams/${teamId}/practice`)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Back to List
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Print Plan
            </button>
          </div>
        </div>

        {/* Practice Notes */}
        {practice.notes && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Practice Notes
            </h2>
            <p className="text-gray-900">{practice.notes}</p>
          </div>
        )}

        {/* Visual Timeline */}
        {practice.periods.length > 0 && (
          <div className="mb-8">
            <PracticeTimeline
              periods={practice.periods.map(p => ({
                id: p.id,
                name: p.name,
                duration_minutes: p.duration_minutes,
                start_time: p.start_time ?? null,
                is_concurrent: p.is_concurrent,
                period_type: p.period_type,
                assigned_coach_id: p.assigned_coach_id,
              }))}
              totalDuration={practice.duration_minutes}
              coaches={coaches}
            />
          </div>
        )}

        {/* Periods */}
        <div className="space-y-6">
          {practice.periods.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-gray-400 mb-4">No periods added to this practice yet</div>
            </div>
          ) : (
            practice.periods.map((period, index) => (
              <div key={period.id} className="bg-white border border-gray-200 rounded-lg p-6">
                {/* Period Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black text-white rounded-lg flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{period.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span>⏱️ {period.duration_minutes} min</span>
                        <span className="capitalize">{period.period_type.replace('_', ' ')}</span>
                        {period.is_concurrent && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 border border-blue-200">
                            {period.assigned_coach_id
                              ? coaches.find(c => c.id === period.assigned_coach_id)?.name || 'Assigned Coach'
                              : 'Concurrent'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Period Notes */}
                {period.notes && (
                  <div className="mb-4 p-4 bg-gray-50 rounded border border-gray-200">
                    <p className="text-sm text-gray-700">{period.notes}</p>
                  </div>
                )}

                {/* Drills */}
                {period.drills.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                      Drills ({period.drills.length})
                    </h4>
                    <div className="space-y-3">
                      {period.drills.map((drill, drillIndex) => (
                        <div
                          key={drill.id}
                          className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-gray-700 text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                              {drillIndex + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <h5 className="font-semibold text-gray-900">{drill.drill_name}</h5>
                                {drill.position_group && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 border border-blue-200">
                                    {drill.position_group}
                                  </span>
                                )}
                              </div>
                              {drill.description && (
                                <p className="text-sm text-gray-600 mb-2">{drill.description}</p>
                              )}
                              {drill.play_codes && drill.play_codes.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-gray-500">Play Codes:</span>
                                  {drill.play_codes.map((code, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 text-xs font-mono rounded bg-gray-200 text-gray-700"
                                    >
                                      {code}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {drill.equipment_needed && (
                                <div className="mt-2 text-xs text-gray-600">
                                  <span className="font-medium">Equipment:</span> {drill.equipment_needed}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {period.drills.length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    No drills added to this period
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Summary Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{practice.periods.length}</div>
              <div className="text-sm text-gray-600">Periods</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {practice.periods.reduce((sum, p) => sum + p.drills.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Drills</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalMinutes}</div>
              <div className="text-sm text-gray-600">Total Minutes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          nav, button {
            display: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
