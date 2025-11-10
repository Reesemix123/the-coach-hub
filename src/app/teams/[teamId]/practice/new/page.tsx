// src/app/teams/[teamId]/practice/new/page.tsx
'use client';

import { use, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import PracticeTimeline from '@/components/PracticeTimeline';

type PeriodType = 'warmup' | 'drill' | 'team' | 'special_teams' | 'conditioning' | 'other';

interface Period {
  id: string;
  name: string;
  duration_minutes: number;
  period_type: PeriodType;
  notes: string;
  start_time: number | null; // Minutes from practice start (null = sequential)
  is_concurrent: boolean;
  drills: Drill[];
}

interface Drill {
  id: string;
  drill_name: string;
  position_group: string;
  description: string;
  play_codes: string[];
}

export default function NewPracticePlanPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  // Practice plan fields
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState(90);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [periods, setPeriods] = useState<Period[]>([]);
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a practice title');
      return;
    }

    setSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      // Create practice plan
      const { data: practice, error: practiceError } = await supabase
        .from('practice_plans')
        .insert({
          team_id: teamId,
          title,
          date,
          duration_minutes: duration,
          location: location || null,
          notes: notes || null,
          is_template: false,
          created_by: userData.user?.id
        })
        .select()
        .single();

      if (practiceError) throw practiceError;

      // Create periods and drills
      for (let i = 0; i < periods.length; i++) {
        const period = periods[i];

        const { data: periodData, error: periodError } = await supabase
          .from('practice_periods')
          .insert({
            practice_plan_id: practice.id,
            period_order: i + 1,
            name: period.name,
            duration_minutes: period.duration_minutes,
            period_type: period.period_type,
            notes: period.notes || null,
            start_time: period.start_time,
            is_concurrent: period.is_concurrent
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

      // Create corresponding schedule event with practice_plan_id link
      const { error: eventError } = await supabase
        .from('team_events')
        .insert({
          team_id: teamId,
          event_type: 'practice',
          title: title,
          description: notes || null,
          date: date,
          location: location || null,
          practice_plan_id: practice.id, // Link to practice plan
          created_by: userData.user?.id
        });

      if (eventError) {
        console.error('Error creating schedule event:', eventError);
        // Don't fail the whole operation if event creation fails
      }

      router.push(`/teams/${teamId}/practice/${practice.id}`);
    } catch (error) {
      console.error('Error saving practice plan:', error);
      alert('Error saving practice plan');
      setSaving(false);
    }
  };

  const totalMinutes = periods.reduce((sum, p) => sum + p.duration_minutes, 0);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Practice Plan</h1>
            <p className="text-gray-600 mt-2">Plan your practice session</p>
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
            <PracticeTimeline periods={periods} totalDuration={duration} />
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
                            <div className="grid grid-cols-2 gap-3">
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
            {saving ? 'Saving...' : 'Create Practice Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
