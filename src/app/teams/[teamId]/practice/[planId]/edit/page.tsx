// src/app/teams/[teamId]/practice/[planId]/edit/page.tsx
'use client';

import { use, useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import PracticeTimeline, { TimelineCoach } from '@/components/PracticeTimeline';

type PeriodType = 'warmup' | 'drill' | 'team' | 'special_teams' | 'conditioning' | 'other';

interface Period {
  id: string;
  name: string;
  duration_minutes: number;
  period_type: PeriodType;
  notes: string;
  start_time: number | null;
  is_concurrent: boolean;
  assigned_coach_id?: string;
  drills: Drill[];
}

interface Drill {
  id: string;
  drill_name: string;
  position_group: string;
  description: string;
  play_codes: string[];
}

export default function EditPracticePlanPage({
  params
}: {
  params: Promise<{ teamId: string; planId: string }>
}) {
  const { teamId, planId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  // Practice plan fields
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState(90);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [periods, setPeriods] = useState<Period[]>([]);
  const [coaches, setCoaches] = useState<TimelineCoach[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [originalDate, setOriginalDate] = useState('');
  // For triggering timeline's reassign modal from period card
  const [periodToReassign, setPeriodToReassign] = useState<string | null>(null);

  useEffect(() => {
    fetchPracticeData();
  }, [planId]);

  async function fetchPracticeData() {
    try {
      // Fetch practice plan
      const { data: practiceData } = await supabase
        .from('practice_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (!practiceData) {
        alert('Practice not found');
        router.push(`/teams/${teamId}/practice`);
        return;
      }

      setTitle(practiceData.title);
      setDate(practiceData.date);
      setOriginalDate(practiceData.date);
      setDuration(practiceData.duration_minutes);
      setLocation(practiceData.location || '');
      setNotes(practiceData.notes || '');

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

      if (periodsData) {
        const periodsWithDrills: Period[] = [];

        for (const period of periodsData) {
          const { data: drillsData } = await supabase
            .from('practice_drills')
            .select('*')
            .eq('period_id', period.id)
            .order('drill_order');

          periodsWithDrills.push({
            id: period.id,
            name: period.name,
            duration_minutes: period.duration_minutes,
            period_type: period.period_type,
            notes: period.notes || '',
            start_time: period.start_time ?? null,
            is_concurrent: period.is_concurrent ?? false,
            assigned_coach_id: period.assigned_coach_id ?? undefined,
            drills: (drillsData || []).map(d => ({
              id: d.id,
              drill_name: d.drill_name,
              position_group: d.position_group || 'All',
              description: d.description || '',
              play_codes: d.play_codes || []
            }))
          });
        }

        setPeriods(periodsWithDrills);
      }
    } catch (error) {
      console.error('Error fetching practice:', error);
      alert('Error loading practice');
    } finally {
      setLoading(false);
    }
  }

  const addPeriod = () => {
    // Calculate default start time (sequential after last period)
    let defaultStartTime: number | null = null;
    if (periods.length > 0) {
      const lastPeriod = periods[periods.length - 1];
      if (lastPeriod.start_time !== null) {
        defaultStartTime = lastPeriod.start_time + lastPeriod.duration_minutes;
      }
    } else {
      defaultStartTime = 0; // First period starts at 0
    }

    const newPeriod: Period = {
      id: `temp-${Date.now()}`,
      name: '',
      duration_minutes: 15,
      period_type: 'drill',
      notes: '',
      start_time: defaultStartTime,
      is_concurrent: false,
      drills: []
    };
    setPeriods([...periods, newPeriod]);
  };

  const removePeriod = (periodId: string) => {
    setPeriods(periods.filter(p => p.id !== periodId));
  };

  const updatePeriod = (periodId: string, updates: Partial<Period>) => {
    setPeriods(periods.map(p =>
      p.id === periodId ? { ...p, ...updates } : p
    ));
  };

  const addDrill = (periodId: string) => {
    const newDrill: Drill = {
      id: `temp-${Date.now()}`,
      drill_name: '',
      position_group: 'All',
      description: '',
      play_codes: []
    };

    setPeriods(periods.map(p =>
      p.id === periodId
        ? { ...p, drills: [...p.drills, newDrill] }
        : p
    ));
  };

  const removeDrill = (periodId: string, drillId: string) => {
    setPeriods(periods.map(p =>
      p.id === periodId
        ? { ...p, drills: p.drills.filter(d => d.id !== drillId) }
        : p
    ));
  };

  const updateDrill = (periodId: string, drillId: string, updates: Partial<Drill>) => {
    setPeriods(periods.map(p =>
      p.id === periodId
        ? { ...p, drills: p.drills.map(d => d.id === drillId ? { ...d, ...updates } : d) }
        : p
    ));
  };

  const handlePeriodReassign = (periodId: string, newCoachId: string) => {
    setPeriods(periods.map(p =>
      p.id === periodId ? { ...p, assigned_coach_id: newCoachId } : p
    ));
  };

  const handlePeriodsSwap = (period1Id: string, coach1Id: string, period2Id: string, coach2Id: string) => {
    // Swap the coach assignments of two periods
    setPeriods(periods.map(p => {
      if (p.id === period1Id) {
        return { ...p, assigned_coach_id: coach1Id };
      }
      if (p.id === period2Id) {
        return { ...p, assigned_coach_id: coach2Id };
      }
      return p;
    }));
  };

  const handleBatchReassign = (reassignments: Array<{ periodId: string; newCoachId: string }>) => {
    // Apply all reassignments at once (for multi-coach chain swaps)
    setPeriods(periods.map(p => {
      const reassignment = reassignments.find(r => r.periodId === p.id);
      if (reassignment) {
        return { ...p, assigned_coach_id: reassignment.newCoachId };
      }
      return p;
    }));
  };

  // Handle opening reassign modal for a period (from period card)
  const handleOpenReassignModal = (periodId: string) => {
    setPeriodToReassign(periodId);
  };

  // Clear the period to reassign after timeline handles it
  const handleReassignModalClosed = () => {
    setPeriodToReassign(null);
  };

  // Helper to check if a string is a valid UUID
  const isValidUUID = (str: string | undefined): boolean => {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a practice title');
      return;
    }

    setSaving(true);

    try {
      // Update practice plan
      const { error: practiceError } = await supabase
        .from('practice_plans')
        .update({
          title,
          date,
          duration_minutes: duration,
          location: location || null,
          notes: notes || null
        })
        .eq('id', planId);

      if (practiceError) throw practiceError;

      // Delete all existing periods and drills (cascade will handle drills)
      await supabase
        .from('practice_periods')
        .delete()
        .eq('practice_plan_id', planId);

      // Create new periods and drills
      for (let i = 0; i < periods.length; i++) {
        const period = periods[i];

        // Only save assigned_coach_id if it's a valid UUID (not guest coach IDs like "guest-123")
        const validCoachId = isValidUUID(period.assigned_coach_id) ? period.assigned_coach_id : null;

        const { data: periodData, error: periodError } = await supabase
          .from('practice_periods')
          .insert({
            practice_plan_id: planId,
            period_order: i + 1,
            name: period.name,
            duration_minutes: period.duration_minutes,
            period_type: period.period_type,
            notes: period.notes || null,
            start_time: period.start_time,
            is_concurrent: period.is_concurrent,
            assigned_coach_id: validCoachId
          })
          .select()
          .single();

        if (periodError) throw periodError;

        // Create drills for this period
        if (period.drills.length > 0) {
          const drillsToInsert = period.drills.map((drill, j) => ({
            period_id: periodData.id,
            drill_order: j + 1,
            drill_name: drill.drill_name,
            position_group: drill.position_group || null,
            description: drill.description || null,
            play_codes: drill.play_codes.length > 0 ? drill.play_codes : null
          }));

          const { error: drillsError } = await supabase
            .from('practice_drills')
            .insert(drillsToInsert);

          if (drillsError) throw drillsError;
        }
      }

      // Update corresponding schedule event (if exists)
      // Find event linked to this practice plan
      const { error: eventError } = await supabase
        .from('team_events')
        .update({
          title: title,
          description: notes || null,
          date: date,
          location: location || null
        })
        .eq('practice_plan_id', planId);

      if (eventError) {
        console.error('Error updating schedule event:', eventError);
      }

      router.push(`/teams/${teamId}/practice/${planId}`);
    } catch (error) {
      console.error('Error saving practice plan:', error);
      alert('Error saving practice plan');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading practice...</div>
      </div>
    );
  }

  // Calculate actual practice duration (accounting for concurrent activities)
  const calculateActualDuration = () => {
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
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Practice Plan</h1>
            <p className="text-gray-600 mt-2">Update your practice session</p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        {/* Basic Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Practice Details</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Practice Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Tuesday Practice - Week 3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Duration (minutes)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Main Field, Gym"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Practice Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="General notes about this practice..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>
        </div>

        {/* Visual Timeline */}
        {periods.length > 0 && (
          <div className="mb-6">
            <PracticeTimeline
              periods={periods}
              totalDuration={duration}
              coaches={coaches}
              editable={true}
              onPeriodReassign={handlePeriodReassign}
              onPeriodsSwap={handlePeriodsSwap}
              onBatchReassign={handleBatchReassign}
              externalSelectedPeriodId={periodToReassign}
              onModalClosed={handleReassignModalClosed}
            />
          </div>
        )}

        {/* Periods */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Practice Periods ({totalMinutes} min total)
            </h2>
            <button
              onClick={addPeriod}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
            >
              + Add Period
            </button>
          </div>

          {periods.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">No periods added yet</p>
              <p className="text-sm">Add periods to structure your practice (Warmup, Drills, Team Period, etc.)</p>
            </div>
          ) : (
            <div className="space-y-6">
              {periods.map((period, index) => (
                <div key={period.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Period Name *
                          </label>
                          <input
                            type="text"
                            value={period.name}
                            onChange={(e) => updatePeriod(period.id, { name: e.target.value })}
                            placeholder="e.g., Warmup, Individual Drills"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Duration (min)
                          </label>
                          <input
                            type="number"
                            value={period.duration_minutes}
                            onChange={(e) => updatePeriod(period.id, { duration_minutes: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Type
                          </label>
                          <select
                            value={period.period_type}
                            onChange={(e) => updatePeriod(period.id, { period_type: e.target.value as PeriodType })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-sm"
                          >
                            <option value="warmup">Warmup</option>
                            <option value="drill">Drill</option>
                            <option value="team">Team Period</option>
                            <option value="special_teams">Special Teams</option>
                            <option value="conditioning">Conditioning</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Period Notes
                        </label>
                        <input
                          type="text"
                          value={period.notes}
                          onChange={(e) => updatePeriod(period.id, { notes: e.target.value })}
                          placeholder="Optional notes about this period..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-sm"
                        />
                      </div>

                      {/* Timeline Controls */}
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium text-blue-900">Timeline</span>
                          {/* Coach display/selector for concurrent periods */}
                          {period.is_concurrent && coaches.length > 0 && (
                            <button
                              onClick={() => handleOpenReassignModal(period.id)}
                              className="ml-auto px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded border border-blue-300 hover:bg-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center gap-1"
                            >
                              {period.assigned_coach_id
                                ? coaches.find(c => c.id === period.assigned_coach_id)?.name || 'Unknown Coach'
                                : 'Select coach...'}
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                          {period.is_concurrent && coaches.length === 0 && (
                            <span className="ml-auto px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              No coaches available
                            </span>
                          )}
                          {!period.is_concurrent && (
                            <span className="ml-auto px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              All coaches
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-blue-800 mb-1">
                              Start Time (min from start)
                            </label>
                            <input
                              type="number"
                              value={period.start_time ?? ''}
                              onChange={(e) => updatePeriod(period.id, { start_time: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Auto (sequential)"
                              className="w-full px-2 py-1.5 border border-blue-300 rounded text-gray-900 text-sm"
                              min="0"
                            />
                            <p className="text-xs text-blue-600 mt-1">Leave empty for sequential</p>
                          </div>
                          <div className="flex items-center">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={period.is_concurrent}
                                onChange={(e) => updatePeriod(period.id, { is_concurrent: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-blue-900">
                                <span className="font-medium">Runs concurrently</span>
                                <br />
                                <span className="text-xs text-blue-700">Multiple groups at same time</span>
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Drills */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">
                            Drills ({period.drills.length})
                          </label>
                          <button
                            onClick={() => addDrill(period.id)}
                            className="text-sm text-gray-700 hover:text-black font-medium"
                          >
                            + Add Drill
                          </button>
                        </div>

                        {period.drills.map((drill, drillIndex) => (
                          <div key={drill.id} className="bg-gray-50 rounded p-3 mb-2 border border-gray-200">
                            <div className="grid grid-cols-2 gap-3 mb-2">
                              <input
                                type="text"
                                value={drill.drill_name}
                                onChange={(e) => updateDrill(period.id, drill.id, { drill_name: e.target.value })}
                                placeholder="Drill name"
                                className="px-3 py-1.5 border border-gray-300 rounded text-gray-900 text-sm"
                              />
                              <div className="flex gap-2">
                                <select
                                  value={drill.position_group}
                                  onChange={(e) => updateDrill(period.id, drill.id, { position_group: e.target.value })}
                                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-gray-900 text-sm"
                                >
                                  <option value="All">All</option>
                                  <option value="QB">QB</option>
                                  <option value="RB">RB</option>
                                  <option value="WR">WR</option>
                                  <option value="TE">TE</option>
                                  <option value="OL">OL</option>
                                  <option value="DL">DL</option>
                                  <option value="LB">LB</option>
                                  <option value="DB">DB</option>
                                  <option value="K/P">K/P</option>
                                </select>
                                <button
                                  onClick={() => removeDrill(period.id, drill.id)}
                                  className="px-3 py-1.5 text-red-600 hover:text-red-700 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                            {/* Drill Description */}
                            <textarea
                              value={drill.description}
                              onChange={(e) => updateDrill(period.id, drill.id, { description: e.target.value })}
                              placeholder="Drill description - explain how to execute this drill..."
                              rows={2}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded text-gray-900 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => removePeriod(period.id)}
                      className="ml-4 text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Remove Period
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
