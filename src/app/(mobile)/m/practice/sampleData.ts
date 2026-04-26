import type { PracticePlanWithDetails } from '@/types/football'

/**
 * Sample practice plan shown when the coach has no real practice plans.
 * Renders through the same PlanCard and viewer components as real data.
 */

const today = new Date().toISOString().split('T')[0]

export const SAMPLE_PRACTICE_PLAN: PracticePlanWithDetails = {
  id: 'sample',
  team_id: '',
  title: 'Sample: Tuesday Practice',
  date: today,
  duration_minutes: 50,
  location: 'Main Field',
  notes: 'This is a sample practice plan to show you what it looks like. Create your own on desktop!',
  is_template: false,
  created_by: undefined,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  periods: [
    {
      id: 'sample-p1',
      practice_plan_id: 'sample',
      period_order: 1,
      name: 'Warmup & Stretching',
      duration_minutes: 10,
      period_type: 'warmup',
      notes: 'Dynamic stretches, jog around the field',
      created_at: new Date().toISOString(),
      drills: [
        {
          id: 'sample-d1',
          period_id: 'sample-p1',
          drill_order: 1,
          drill_name: 'Dynamic Stretches',
          description: 'High knees, butt kicks, karaoke, lunges',
          position_group: 'All',
          created_at: new Date().toISOString(),
        },
      ],
    },
    {
      id: 'sample-p2',
      practice_plan_id: 'sample',
      period_order: 2,
      name: 'Individual Drills',
      duration_minutes: 15,
      period_type: 'drill',
      notes: 'Position-specific skill work',
      created_at: new Date().toISOString(),
      drills: [
        {
          id: 'sample-d2',
          period_id: 'sample-p2',
          drill_order: 1,
          drill_name: 'Route Tree (WR/TE)',
          description: 'Run slant, out, and comeback routes',
          position_group: 'Receivers',
          created_at: new Date().toISOString(),
        },
        {
          id: 'sample-d3',
          period_id: 'sample-p2',
          drill_order: 2,
          drill_name: 'Pass Rush Moves (DL)',
          description: 'Swim, rip, and bull rush technique',
          position_group: 'D-Line',
          created_at: new Date().toISOString(),
        },
      ],
    },
    {
      id: 'sample-p3',
      practice_plan_id: 'sample',
      period_order: 3,
      name: 'Team Run Install',
      duration_minutes: 20,
      period_type: 'team',
      notes: 'Install Inside Zone and Counter',
      created_at: new Date().toISOString(),
      drills: [
        {
          id: 'sample-d4',
          period_id: 'sample-p3',
          drill_order: 1,
          drill_name: 'Inside Zone Walk-Through',
          description: 'Walk through assignments at half speed',
          position_group: 'All',
          created_at: new Date().toISOString(),
        },
        {
          id: 'sample-d5',
          period_id: 'sample-p3',
          drill_order: 2,
          drill_name: 'Inside Zone Live Reps',
          description: 'Full speed reps vs scout defense',
          position_group: 'All',
          equipment_needed: 'Cones',
          created_at: new Date().toISOString(),
        },
      ],
    },
    {
      id: 'sample-p4',
      practice_plan_id: 'sample',
      period_order: 4,
      name: 'Cool Down',
      duration_minutes: 5,
      period_type: 'conditioning',
      notes: 'Static stretches and team huddle',
      created_at: new Date().toISOString(),
      drills: [
        {
          id: 'sample-d6',
          period_id: 'sample-p4',
          drill_order: 1,
          drill_name: 'Static Stretching',
          description: 'Hamstrings, quads, shoulders',
          position_group: 'All',
          created_at: new Date().toISOString(),
        },
      ],
    },
  ],
}
