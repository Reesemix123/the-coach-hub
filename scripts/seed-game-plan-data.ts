/**
 * Seed Game Plan Test Data
 * Run with: npx tsx scripts/seed-game-plan-data.ts
 *
 * This script seeds the database with test plays and setup/counter relationships.
 * Uses the anon key which should work with RLS policies for the team owner.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bawcgmongnswmrxfsweh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhd2NnbW9uZ25zd21yeGZzd2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTI4MzAsImV4cCI6MjA2NDA4ODgzMH0.hN8_Vgm5GxSVazYYIITjsHAR-7lZQKz5R6jqqXCPGQ0';

const TEAM_ID = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test plays data
const TEST_PLAYS = [
  // Inside Zone
  {
    play_code: 'IZ-R',
    play_name: 'Inside Zone Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Run', runConcept: 'Inside Zone', personnel: '11 (1RB-1TE-3WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: 450, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  {
    play_code: 'IZ-L',
    play_name: 'Inside Zone Left',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Run', runConcept: 'Inside Zone', personnel: '11 (1RB-1TE-3WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: 250, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  // Outside Zone
  {
    play_code: 'OZ-R',
    play_name: 'Outside Zone Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Run', runConcept: 'Outside Zone', personnel: '11 (1RB-1TE-3WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: 550, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  {
    play_code: 'OZ-L',
    play_name: 'Outside Zone Left',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Run', runConcept: 'Outside Zone', personnel: '11 (1RB-1TE-3WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: 150, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  // Counter plays
  {
    play_code: 'CTR-R',
    play_name: 'Counter Trey Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'I-Form Pro', playType: 'Run', runConcept: 'Counter', personnel: '21 (2RB-1TE-2WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'I-Form Pro', players: [{ position: 'QB', x: 350, y: 280, label: 'QB' }, { position: 'FB', x: 350, y: 320, label: 'FB' }, { position: 'TB', x: 350, y: 360, label: 'TB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'Y', x: 650, y: 200, label: 'Y' }, { position: 'TE', x: 520, y: 200, label: 'TE' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'tb-route', playerId: 'TB', path: [{ x: 350, y: 360 }, { x: 250, y: 300 }, { x: 500, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  {
    play_code: 'CTR-L',
    play_name: 'Counter Trey Left',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'I-Form Pro', playType: 'Run', runConcept: 'Counter', personnel: '21 (2RB-1TE-2WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'I-Form Pro', players: [{ position: 'QB', x: 350, y: 280, label: 'QB' }, { position: 'FB', x: 350, y: 320, label: 'FB' }, { position: 'TB', x: 350, y: 360, label: 'TB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'Y', x: 550, y: 200, label: 'Y' }, { position: 'TE', x: 180, y: 200, label: 'TE' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'tb-route', playerId: 'TB', path: [{ x: 350, y: 360 }, { x: 450, y: 300 }, { x: 200, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  // Power plays
  {
    play_code: 'PWR-R',
    play_name: 'Power Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'I-Form Pro', playType: 'Run', runConcept: 'Power', personnel: '21 (2RB-1TE-2WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'I-Form Pro', players: [{ position: 'QB', x: 350, y: 280, label: 'QB' }, { position: 'FB', x: 350, y: 320, label: 'FB' }, { position: 'TB', x: 350, y: 360, label: 'TB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'Y', x: 650, y: 200, label: 'Y' }, { position: 'TE', x: 520, y: 200, label: 'TE' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'tb-route', playerId: 'TB', path: [{ x: 350, y: 360 }, { x: 480, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  {
    play_code: 'PWR-L',
    play_name: 'Power Left',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'I-Form Pro', playType: 'Run', runConcept: 'Power', personnel: '21 (2RB-1TE-2WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'I-Form Pro', players: [{ position: 'QB', x: 350, y: 280, label: 'QB' }, { position: 'FB', x: 350, y: 320, label: 'FB' }, { position: 'TB', x: 350, y: 360, label: 'TB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'Y', x: 650, y: 200, label: 'Y' }, { position: 'TE', x: 180, y: 200, label: 'TE' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'tb-route', playerId: 'TB', path: [{ x: 350, y: 360 }, { x: 220, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  // Quick Pass
  {
    play_code: 'SLNT-R',
    play_name: 'Slant Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Slant', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Slide', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 550, y: 140 }], type: 'pass', routeType: 'Slant', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'SLNT-L',
    play_name: 'Slant Left',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Slant', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Slide', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'x-route', playerId: 'X', path: [{ x: 50, y: 200 }, { x: 150, y: 140 }], type: 'pass', routeType: 'Slant', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'HTCH-3',
    play_name: 'Triple Hitch',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Trips', playType: 'Pass', passConcept: 'Hitch', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Slide', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Trips', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 550, y: 220, label: 'H' }, { position: 'Y', x: 600, y: 210, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 650, y: 160 }], type: 'pass', routeType: 'Hitch', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'BUBL-R',
    play_name: 'Bubble Screen Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Screen', passConcept: 'Bubble Screen', personnel: '10 (1RB-0TE-4WR)', protection: 'None', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 550, y: 220, label: 'H' }, { position: 'Y', x: 600, y: 210, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'h-route', playerId: 'H', path: [{ x: 550, y: 220 }, { x: 620, y: 220 }], type: 'pass', routeType: 'Bubble', isPrimary: true }] },
    is_archived: false
  },
  // Intermediate Pass
  {
    play_code: 'CURL-FLT',
    play_name: 'Curl-Flat Combo',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Curl-Flat', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Slide', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'x-route', playerId: 'X', path: [{ x: 50, y: 200 }, { x: 50, y: 140 }, { x: 50, y: 140 }], type: 'pass', routeType: 'Curl', isPrimary: true }, { id: 'h-route', playerId: 'H', path: [{ x: 150, y: 220 }, { x: 50, y: 200 }], type: 'pass', routeType: 'Flat' }] },
    is_archived: false
  },
  {
    play_code: 'DIG-R',
    play_name: 'Dig Route Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Dig', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Slide', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 650, y: 130 }, { x: 400, y: 130 }], type: 'pass', routeType: 'Dig', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'OUT-R',
    play_name: 'Out Route Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Out', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Slide', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 650, y: 150 }, { x: 700, y: 150 }], type: 'pass', routeType: 'Out', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'MESH',
    play_name: 'Mesh Concept',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Mesh', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Slide', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'h-route', playerId: 'H', path: [{ x: 150, y: 220 }, { x: 500, y: 180 }], type: 'pass', routeType: 'Mesh', isPrimary: true }, { id: 'y-route', playerId: 'Y', path: [{ x: 550, y: 220 }, { x: 200, y: 180 }], type: 'pass', routeType: 'Mesh' }] },
    is_archived: false
  },
  {
    play_code: 'LVLS',
    play_name: 'Levels Concept',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Trips', playType: 'Pass', passConcept: 'Levels', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Slide', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Trips', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 550, y: 220, label: 'H' }, { position: 'Y', x: 600, y: 210, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'h-route', playerId: 'H', path: [{ x: 550, y: 220 }, { x: 400, y: 180 }], type: 'pass', routeType: 'In' }, { id: 'y-route', playerId: 'Y', path: [{ x: 600, y: 210 }, { x: 400, y: 130 }], type: 'pass', routeType: 'Dig', isPrimary: true }] },
    is_archived: false
  },
  // Deep Pass
  {
    play_code: '4VERTS',
    play_name: 'Four Verticals',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Four Verts', personnel: '10 (1RB-0TE-4WR)', protection: '5-Man Max', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'x-route', playerId: 'X', path: [{ x: 50, y: 200 }, { x: 50, y: 50 }], type: 'pass', routeType: 'Go' }, { id: 'h-route', playerId: 'H', path: [{ x: 150, y: 220 }, { x: 200, y: 50 }], type: 'pass', routeType: 'Seam' }, { id: 'y-route', playerId: 'Y', path: [{ x: 550, y: 220 }, { x: 500, y: 50 }], type: 'pass', routeType: 'Seam' }, { id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 650, y: 50 }], type: 'pass', routeType: 'Go', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'POST-R',
    play_name: 'Post Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Post', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Max', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 650, y: 130 }, { x: 400, y: 50 }], type: 'pass', routeType: 'Post', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'CRNR-R',
    play_name: 'Corner Route Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Corner', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Max', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 650, y: 130 }, { x: 700, y: 50 }], type: 'pass', routeType: 'Corner', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'SEAM-R',
    play_name: 'Seam Route Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Trips', playType: 'Pass', passConcept: 'Seam', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Max', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Trips', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 550, y: 220, label: 'H' }, { position: 'Y', x: 600, y: 210, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'h-route', playerId: 'H', path: [{ x: 550, y: 220 }, { x: 550, y: 50 }], type: 'pass', routeType: 'Seam', isPrimary: true }] },
    is_archived: false
  },
  // Play Action
  {
    play_code: 'PA-IZ-POST',
    play_name: 'Play Action IZ Post',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Play Action', passConcept: 'Post', runConcept: 'Inside Zone', personnel: '11 (1RB-1TE-3WR)', protection: 'Play Action', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 650, y: 130 }, { x: 400, y: 50 }], type: 'pass', routeType: 'Post', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'PA-PWR-BOOT',
    play_name: 'Power Boot Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'I-Form Pro', playType: 'Play Action', passConcept: 'Bootleg', runConcept: 'Power', personnel: '21 (2RB-1TE-2WR)', protection: 'Bootleg', motion: 'None' },
    diagram: { odk: 'offense', formation: 'I-Form Pro', players: [{ position: 'QB', x: 350, y: 280, label: 'QB' }, { position: 'FB', x: 350, y: 320, label: 'FB' }, { position: 'TB', x: 350, y: 360, label: 'TB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'Y', x: 650, y: 200, label: 'Y' }, { position: 'TE', x: 520, y: 200, label: 'TE' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'qb-route', playerId: 'QB', path: [{ x: 350, y: 280 }, { x: 550, y: 260 }], type: 'run' }, { id: 'te-route', playerId: 'TE', path: [{ x: 520, y: 200 }, { x: 650, y: 160 }], type: 'pass', routeType: 'Flat', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'PA-OZ-WHEEL',
    play_name: 'Outside Zone Wheel',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Play Action', passConcept: 'Wheel', runConcept: 'Outside Zone', personnel: '11 (1RB-1TE-3WR)', protection: 'Play Action', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: 200, y: 200 }, { x: 50, y: 50 }], type: 'pass', routeType: 'Wheel', isPrimary: true }] },
    is_archived: false
  },
  // RPO
  {
    play_code: 'RPO-IZ-SLNT',
    play_name: 'RPO Inside Zone Slant',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'RPO', passConcept: 'Slant', runConcept: 'Inside Zone', personnel: '11 (1RB-1TE-3WR)', protection: 'RPO', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: 450, y: 150 }], type: 'run' }, { id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 550, y: 140 }], type: 'pass', routeType: 'Slant' }] },
    is_archived: false
  },
  {
    play_code: 'RPO-IZ-BUBL',
    play_name: 'RPO Inside Zone Bubble',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'RPO', passConcept: 'Bubble Screen', runConcept: 'Inside Zone', personnel: '10 (1RB-0TE-4WR)', protection: 'RPO', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 550, y: 220, label: 'H' }, { position: 'Y', x: 600, y: 210, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: 450, y: 150 }], type: 'run' }, { id: 'h-route', playerId: 'H', path: [{ x: 550, y: 220 }, { x: 620, y: 220 }], type: 'pass', routeType: 'Bubble' }] },
    is_archived: false
  },
  {
    play_code: 'RPO-PWR-POP',
    play_name: 'RPO Power Pop Pass',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Trips', playType: 'RPO', passConcept: 'Pop Pass', runConcept: 'Power', personnel: '11 (1RB-1TE-3WR)', protection: 'RPO', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Trips', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 550, y: 220, label: 'H' }, { position: 'Y', x: 600, y: 210, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: 480, y: 150 }], type: 'run' }, { id: 'y-route', playerId: 'Y', path: [{ x: 600, y: 210 }, { x: 600, y: 180 }], type: 'pass', routeType: 'Pop' }] },
    is_archived: false
  },
  // Screens
  {
    play_code: 'SCRN-RB',
    play_name: 'RB Screen',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Screen', passConcept: 'RB Screen', personnel: '11 (1RB-1TE-3WR)', protection: 'Screen', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: 200, y: 250 }], type: 'pass', routeType: 'Screen', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'SCRN-WR-R',
    play_name: 'WR Screen Right',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Screen', passConcept: 'WR Screen', personnel: '10 (1RB-0TE-4WR)', protection: 'Screen', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 620, y: 220 }], type: 'pass', routeType: 'Screen', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'SCRN-TUNL',
    play_name: 'Tunnel Screen',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Trips', playType: 'Screen', passConcept: 'Tunnel Screen', personnel: '11 (1RB-1TE-3WR)', protection: 'Screen', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Trips', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 550, y: 220, label: 'H' }, { position: 'Y', x: 600, y: 210, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'h-route', playerId: 'H', path: [{ x: 550, y: 220 }, { x: 450, y: 200 }], type: 'pass', routeType: 'Tunnel', isPrimary: true }] },
    is_archived: false
  },
  // Draws
  {
    play_code: 'DRAW-DLY',
    play_name: 'Delay Draw',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Run', runConcept: 'Draw', personnel: '11 (1RB-1TE-3WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: 350, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  {
    play_code: 'DRAW-QB',
    play_name: 'QB Draw',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Empty', playType: 'Run', runConcept: 'QB Draw', personnel: '10 (1RB-0TE-4WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Empty', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'A', x: 100, y: 200, label: 'A' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'qb-route', playerId: 'QB', path: [{ x: 350, y: 260 }, { x: 350, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  // Goal Line
  {
    play_code: 'GL-DIVE',
    play_name: 'Goal Line Dive',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Goal Line', playType: 'Run', runConcept: 'Dive', personnel: '23 (2RB-3TE-0WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Goal Line', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'FB', x: 350, y: 300, label: 'FB' }, { position: 'TB', x: 350, y: 340, label: 'TB' }, { position: 'TE1', x: 180, y: 200, label: 'TE' }, { position: 'TE2', x: 520, y: 200, label: 'TE' }, { position: 'TE3', x: 560, y: 200, label: 'TE' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'tb-route', playerId: 'TB', path: [{ x: 350, y: 340 }, { x: 350, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  {
    play_code: 'GL-SNEAK',
    play_name: 'QB Sneak',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Goal Line', playType: 'Run', runConcept: 'QB Sneak', personnel: '23 (2RB-3TE-0WR)', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Goal Line', players: [{ position: 'QB', x: 350, y: 230, label: 'QB' }, { position: 'FB', x: 350, y: 270, label: 'FB' }, { position: 'TB', x: 350, y: 310, label: 'TB' }, { position: 'TE1', x: 180, y: 200, label: 'TE' }, { position: 'TE2', x: 520, y: 200, label: 'TE' }, { position: 'TE3', x: 560, y: 200, label: 'TE' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'qb-route', playerId: 'QB', path: [{ x: 350, y: 230 }, { x: 350, y: 180 }], type: 'run' }] },
    is_archived: false
  },
  {
    play_code: 'GL-FADE',
    play_name: 'Goal Line Fade',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Fade', personnel: '11 (1RB-1TE-3WR)', protection: 'Quick', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 680, y: 100 }], type: 'pass', routeType: 'Fade', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: 'GL-SLNT',
    play_name: 'Goal Line Slant',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Slant', personnel: '11 (1RB-1TE-3WR)', protection: 'Quick', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 550, y: 170 }], type: 'pass', routeType: 'Slant', isPrimary: true }] },
    is_archived: false
  },
  // 2-Minute
  {
    play_code: '2M-SPIKE',
    play_name: 'Clock Spike',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Spike', personnel: '11 (1RB-1TE-3WR)', protection: 'Quick', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [] },
    is_archived: false
  },
  {
    play_code: '2M-OUTS',
    play_name: '2-Minute Outs',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Out', personnel: '10 (1RB-0TE-4WR)', protection: '5-Man Quick', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'x-route', playerId: 'X', path: [{ x: 50, y: 200 }, { x: 50, y: 150 }, { x: 0, y: 150 }], type: 'pass', routeType: 'Out' }, { id: 'z-route', playerId: 'Z', path: [{ x: 650, y: 200 }, { x: 650, y: 150 }, { x: 700, y: 150 }], type: 'pass', routeType: 'Out', isPrimary: true }] },
    is_archived: false
  },
  {
    play_code: '2M-DRVR',
    play_name: '2-Minute Drive',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', passConcept: 'Drive', personnel: '11 (1RB-1TE-3WR)', protection: '5-Man Quick', motion: 'None' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'y-route', playerId: 'Y', path: [{ x: 550, y: 220 }, { x: 550, y: 150 }, { x: 400, y: 150 }], type: 'pass', routeType: 'Dig', isPrimary: true }] },
    is_archived: false
  },
  // Motion Plays
  {
    play_code: 'JET-SWEP',
    play_name: 'Jet Sweep',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Run', runConcept: 'Jet Sweep', personnel: '11 (1RB-1TE-3WR)', motion: 'Jet' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'h-route', playerId: 'H', path: [{ x: 150, y: 220 }, { x: 350, y: 230 }, { x: 550, y: 150 }], type: 'run', routeType: 'Jet' }] },
    is_archived: false
  },
  {
    play_code: 'JET-FAKE-IZ',
    play_name: 'Jet Fake Inside Zone',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Run', runConcept: 'Inside Zone', personnel: '11 (1RB-1TE-3WR)', motion: 'Jet' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: 450, y: 150 }], type: 'run' }] },
    is_archived: false
  },
  {
    play_code: 'ORBIT-SCRN',
    play_name: 'Orbit Screen',
    team_id: TEAM_ID,
    attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Screen', passConcept: 'Orbit Screen', personnel: '11 (1RB-1TE-3WR)', motion: 'Orbit' },
    diagram: { odk: 'offense', formation: 'Shotgun Spread', players: [{ position: 'QB', x: 350, y: 260, label: 'QB' }, { position: 'RB', x: 350, y: 300, label: 'RB' }, { position: 'X', x: 50, y: 200, label: 'X' }, { position: 'H', x: 150, y: 220, label: 'H' }, { position: 'Y', x: 550, y: 220, label: 'Y' }, { position: 'Z', x: 650, y: 200, label: 'Z' }, { position: 'LT', x: 220, y: 200, label: 'LT' }, { position: 'LG', x: 270, y: 200, label: 'LG' }, { position: 'C', x: 350, y: 200, label: 'C' }, { position: 'RG', x: 430, y: 200, label: 'RG' }, { position: 'RT', x: 480, y: 200, label: 'RT' }], routes: [{ id: 'h-route', playerId: 'H', path: [{ x: 150, y: 220 }, { x: 300, y: 280 }, { x: 200, y: 220 }], type: 'pass', routeType: 'Orbit', isPrimary: true }] },
    is_archived: false
  }
];

// Setup/Counter Relationships
const RELATIONSHIPS = [
  // Inside Zone setups Counter plays
  { team_id: TEAM_ID, setup_play_code: 'IZ-R', counter_play_code: 'CTR-L', key_position: 'MLB', key_indicator: 'cheating_inside', notes: 'Counter when MLB is crashing A-gap' },
  { team_id: TEAM_ID, setup_play_code: 'IZ-L', counter_play_code: 'CTR-R', key_position: 'MLB', key_indicator: 'cheating_inside', notes: 'Counter when MLB is crashing A-gap' },
  { team_id: TEAM_ID, setup_play_code: 'IZ-R', counter_play_code: 'PA-IZ-POST', key_position: 'SS', key_indicator: 'run_fit_aggressive', notes: 'Play action when SS is filling run' },

  // Outside Zone setups Boot/Counter
  { team_id: TEAM_ID, setup_play_code: 'OZ-R', counter_play_code: 'PA-PWR-BOOT', key_position: 'WILL', key_indicator: 'run_fit_aggressive', notes: 'Boot when LBs are flowing hard' },
  { team_id: TEAM_ID, setup_play_code: 'OZ-L', counter_play_code: 'PA-OZ-WHEEL', key_position: 'SS', key_indicator: 'run_fit_aggressive', notes: 'Wheel when SS is crashing' },

  // Power setups Counter
  { team_id: TEAM_ID, setup_play_code: 'PWR-R', counter_play_code: 'CTR-L', key_position: 'WILL', key_indicator: 'cheating_inside', notes: 'Counter when WILL cheats to strong side' },
  { team_id: TEAM_ID, setup_play_code: 'PWR-L', counter_play_code: 'CTR-R', key_position: 'SAM', key_indicator: 'cheating_inside', notes: 'Counter when SAM cheats to strong side' },

  // Slant setups Out routes
  { team_id: TEAM_ID, setup_play_code: 'SLNT-R', counter_play_code: 'OUT-R', key_position: 'CB1', key_indicator: 'jumping_routes', notes: 'Out route when CB is jumping inside' },
  { team_id: TEAM_ID, setup_play_code: 'SLNT-L', counter_play_code: 'CRNR-R', key_position: 'CB2', key_indicator: 'soft_coverage', notes: 'Corner when CB is playing soft' },

  // Quick game setups deep shots
  { team_id: TEAM_ID, setup_play_code: 'HTCH-3', counter_play_code: '4VERTS', key_position: 'FS', key_indicator: 'robber_technique', notes: 'Verticals when FS is robbing underneath' },
  { team_id: TEAM_ID, setup_play_code: 'CURL-FLT', counter_play_code: 'POST-R', key_position: 'FS', key_indicator: 'robber_technique', notes: 'Post when FS is jumping curl' },

  // Bubble setups inside runs
  { team_id: TEAM_ID, setup_play_code: 'BUBL-R', counter_play_code: 'IZ-L', key_position: 'CB1', key_indicator: 'biting_motion', notes: 'Inside Zone when CB is chasing bubble' },

  // Jet motion setups
  { team_id: TEAM_ID, setup_play_code: 'JET-SWEP', counter_play_code: 'JET-FAKE-IZ', key_position: 'WILL', key_indicator: 'biting_motion', notes: 'Inside Zone when LB is chasing jet' },
  { team_id: TEAM_ID, setup_play_code: 'JET-SWEP', counter_play_code: 'PA-IZ-POST', key_position: 'SS', key_indicator: 'biting_motion', notes: 'Play action when SS is biting on jet' },

  // Draw setups
  { team_id: TEAM_ID, setup_play_code: 'DRAW-DLY', counter_play_code: 'POST-R', key_position: 'MLB', key_indicator: 'spy_qb', notes: 'Post when MLB is spying QB' },

  // RPO setups
  { team_id: TEAM_ID, setup_play_code: 'RPO-IZ-SLNT', counter_play_code: 'RPO-IZ-BUBL', key_position: 'NB', key_indicator: 'jumping_routes', notes: 'Bubble when slot is jumping slant' },
  { team_id: TEAM_ID, setup_play_code: 'RPO-IZ-BUBL', counter_play_code: 'IZ-R', key_position: 'CB1', key_indicator: 'biting_motion', notes: 'Commit to run when CB is chasing bubble' }
];

async function main() {
  console.log('Starting seed process...\n');

  // Step 1: Delete existing relationships
  console.log('Deleting existing play relationships...');
  const { error: relError } = await supabase
    .from('play_relationships')
    .delete()
    .eq('team_id', TEAM_ID);

  if (relError) {
    console.log('Note: Could not delete relationships (may not exist or no permissions):', relError.message);
  } else {
    console.log('Deleted existing play relationships');
  }

  // Step 2: Delete existing plays
  console.log('\nDeleting existing plays...');
  const { error: playError } = await supabase
    .from('playbook_plays')
    .delete()
    .or(`team_id.eq.${TEAM_ID},team_id.is.null`);

  if (playError) {
    console.log('Note: Could not delete plays (may not exist or no permissions):', playError.message);
  } else {
    console.log('Deleted existing plays');
  }

  // Step 3: Insert new plays
  console.log('\nInserting test plays...');
  const { data: insertedPlays, error: insertError } = await supabase
    .from('playbook_plays')
    .insert(TEST_PLAYS)
    .select();

  if (insertError) {
    console.error('Error inserting plays:', insertError.message);
    console.error('Details:', insertError);
    return;
  }

  console.log(`Inserted ${insertedPlays?.length || 0} plays`);

  // Step 4: Insert relationships
  console.log('\nInserting setup/counter relationships...');
  const { data: insertedRels, error: relInsertError } = await supabase
    .from('play_relationships')
    .insert(RELATIONSHIPS)
    .select();

  if (relInsertError) {
    console.error('Error inserting relationships:', relInsertError.message);
    console.error('Details:', relInsertError);
  } else {
    console.log(`Inserted ${insertedRels?.length || 0} relationships`);
  }

  console.log('\nSeed complete!');
  console.log(`Total plays: ${insertedPlays?.length || 0}`);
  console.log(`Total relationships: ${insertedRels?.length || 0}`);
}

main().catch(console.error);
