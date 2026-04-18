/**
 * Seed Test Plays for Mobile Sideline Tracker
 *
 * Seeds playbook_plays into Team Reese, then creates a game plan
 * with wristband call_numbers so the sideline wristband mode works.
 *
 * Run with: npx tsx scripts/seed-test-plays.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEAM_ID = '4feec66c-a6e3-428b-b9ea-3c9485d70f66' // Team Reese

// ---------------------------------------------------------------------------
// Play definitions
// ---------------------------------------------------------------------------
// Columns: play_code, play_name, team_id, attributes (JSONB), diagram (JSONB), is_archived
// attributes.odk: 'offense' | 'defense' | 'specialTeams'
// attributes.playType: 'Run' | 'Pass' | etc.
// attributes.formation: formation name
// attributes.direction: 'left' | 'middle' | 'right'
// Wristband number → game_plan_plays.call_number (seeded separately)

interface PlaySeed {
  play_code: string
  play_name: string
  team_id: string
  attributes: Record<string, string>
  diagram: Record<string, unknown>
  is_archived: boolean
  _wristband: number // local only — used to create game_plan_plays
}

const PLAYS: PlaySeed[] = [
  // ---- Offense — Run ----
  {
    play_code: 'PWR-R',
    play_name: 'Power Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'I-Form Pro', playType: 'Run', runConcept: 'Power', direction: 'right', personnel: '21 (2RB-1TE-2WR)' },
    diagram: { odk: 'offense', formation: 'I-Form Pro', players: [], routes: [] },
    is_archived: false,
    _wristband: 21,
  },
  {
    play_code: 'STR-L',
    play_name: 'Stretch Left',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Run', runConcept: 'Outside Zone', direction: 'left', personnel: '11 (1RB-1TE-3WR)' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [], routes: [] },
    is_archived: false,
    _wristband: 17,
  },
  {
    play_code: 'QB-SNK',
    play_name: 'QB Sneak',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Under Center', playType: 'Run', runConcept: 'QB Sneak', direction: 'middle', personnel: '22 (2RB-2TE-1WR)' },
    diagram: { odk: 'offense', formation: 'Under Center', players: [], routes: [] },
    is_archived: false,
    _wristband: 8,
  },
  {
    play_code: 'CTR-L',
    play_name: 'Counter Left',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'I-Form Pro', playType: 'Run', runConcept: 'Counter', direction: 'left', personnel: '21 (2RB-1TE-2WR)' },
    diagram: { odk: 'offense', formation: 'I-Form Pro', players: [], routes: [] },
    is_archived: false,
    _wristband: 33,
  },

  // ---- Offense — Pass ----
  {
    play_code: 'SLNT-R',
    play_name: 'Slant Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Slant', direction: 'right', personnel: '11 (1RB-1TE-3WR)' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [], routes: [] },
    is_archived: false,
    _wristband: 31,
  },
  {
    play_code: 'POST-CRNR',
    play_name: 'Post Corner',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Post-Corner', direction: 'left', personnel: '11 (1RB-1TE-3WR)' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [], routes: [] },
    is_archived: false,
    _wristband: 44,
  },
  {
    play_code: 'CURL-FLT',
    play_name: 'Curl Flat',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Curl-Flat', direction: 'right', personnel: '11 (1RB-1TE-3WR)' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [], routes: [] },
    is_archived: false,
    _wristband: 52,
  },
  {
    play_code: 'FADE-L',
    play_name: 'Fade Left',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Fade', direction: 'left', personnel: '11 (1RB-1TE-3WR)' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [], routes: [] },
    is_archived: false,
    _wristband: 29,
  },

  // ---- Defense ----
  {
    play_code: 'COV2',
    play_name: 'Cover 2',
    team_id: TEAM_ID,
    attributes: { odk: 'defense', formation: '4-3', coverage: 'Cover 2' },
    diagram: { odk: 'defense', formation: '4-3', players: [], routes: [] },
    is_archived: false,
    _wristband: 71,
  },
  {
    play_code: 'COV3-Z',
    play_name: 'Cover 3 Zone',
    team_id: TEAM_ID,
    attributes: { odk: 'defense', formation: '3-4', coverage: 'Cover 3' },
    diagram: { odk: 'defense', formation: '3-4', players: [], routes: [] },
    is_archived: false,
    _wristband: 74,
  },
  {
    play_code: 'BLTZ-M',
    play_name: 'Blitz Mike',
    team_id: TEAM_ID,
    attributes: { odk: 'defense', formation: '4-3', coverage: 'Cover 1', blitzType: 'Mike' },
    diagram: { odk: 'defense', formation: '4-3', players: [], routes: [] },
    is_archived: false,
    _wristband: 88,
  },

  // ---- Special Teams ----
  {
    play_code: 'KR-MID',
    play_name: 'Kickoff Return Middle',
    team_id: TEAM_ID,
    attributes: { odk: 'specialTeams', unit: 'Kickoff Return', returnScheme: 'Middle Return' },
    diagram: { odk: 'specialTeams', formation: 'Kickoff Return', players: [], routes: [] },
    is_archived: false,
    _wristband: 91,
  },
  {
    play_code: 'PNT-BLK',
    play_name: 'Punt Block',
    team_id: TEAM_ID,
    attributes: { odk: 'specialTeams', unit: 'Punt Block' },
    diagram: { odk: 'specialTeams', formation: 'Punt Block', players: [], routes: [] },
    is_archived: false,
    _wristband: 95,
  },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding ${PLAYS.length} plays into Team Reese (${TEAM_ID})...\n`)

  // Step 1: Delete existing plays for this team (clean slate)
  const { error: deleteErr } = await supabase
    .from('playbook_plays')
    .delete()
    .eq('team_id', TEAM_ID)

  if (deleteErr) {
    console.error('Failed to delete existing plays:', deleteErr.message)
    process.exit(1)
  }
  console.log('Cleared existing plays.')

  // Step 2: Insert plays (strip _wristband before inserting)
  const rows = PLAYS.map(({ _wristband, ...rest }) => rest)

  const { data: inserted, error: insertErr } = await supabase
    .from('playbook_plays')
    .insert(rows)
    .select('id, play_code, play_name')

  if (insertErr) {
    console.error('Failed to insert plays:', insertErr.message)
    process.exit(1)
  }

  console.log(`Inserted ${inserted.length} plays:`)
  for (const p of inserted) {
    console.log(`  ${p.play_code.padEnd(12)} ${p.play_name}`)
  }

  // Step 3: Create a game plan for wristband mode
  // Delete any existing game plans for this team first
  await supabase.from('game_plans').delete().eq('team_id', TEAM_ID)

  const { data: gamePlan, error: gpErr } = await supabase
    .from('game_plans')
    .insert({
      team_id: TEAM_ID,
      name: 'Mobile Test Game Plan',
      wristband_format: '3x5',
    })
    .select('id')
    .single()

  if (gpErr || !gamePlan) {
    console.error('Failed to create game plan:', gpErr?.message)
    process.exit(1)
  }

  console.log(`\nCreated game plan: ${gamePlan.id}`)

  // Step 4: Assign wristband call_numbers via game_plan_plays
  const gamePlanPlays = PLAYS.map((play, index) => ({
    game_plan_id: gamePlan.id,
    play_code: play.play_code,
    call_number: play._wristband,
    sort_order: index + 1,
  }))

  const { data: gppInserted, error: gppErr } = await supabase
    .from('game_plan_plays')
    .insert(gamePlanPlays)
    .select('play_code, call_number')

  if (gppErr) {
    console.error('Failed to insert game plan plays:', gppErr.message)
    process.exit(1)
  }

  console.log(`Assigned ${gppInserted.length} wristband numbers:`)
  for (const gpp of gppInserted) {
    const play = PLAYS.find((p) => p.play_code === gpp.play_code)
    console.log(`  #${String(gpp.call_number).padStart(2, '0')}  ${play?.play_name ?? gpp.play_code}`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
