// ============================================================================
// FOOTBALL POSITIONS — single source of truth
//
// Three-layer model:
//   1. POSITION_CATEGORIES — broad identities (12). Stable. Used everywhere.
//   2. SCHEME_TEMPLATES — system-provided scheme definitions coaches clone.
//   3. categoryFromSlot() — maps a scheme slot back to its category for stats.
//
// Edits to this file must be matched in the position_categories DB table
// (seed migration 190). Treat this as a content file, not application logic.
// ============================================================================

export type PositionUnit = 'offense' | 'defense' | 'special_teams' | 'flex'
export type SchemeUnit = 'offense' | 'defense' | 'special_teams'
export type AgeGroup = 'youth' | 'high_school' | 'all'

export interface PositionCategory {
  code: string
  name: string
  unit: PositionUnit
  sortOrder: number
}

export interface SchemeSlot {
  slotCode: string
  label: string
  category: string                  // POSITION_CATEGORIES code
  diagramX?: number
  diagramY?: number
  optional?: boolean
}

export interface SchemeTemplate {
  key: string                       // stable analytics id
  name: string                      // user-visible default
  unit: SchemeUnit
  ageGroup: AgeGroup
  description: string
  slots: SchemeSlot[]
}

// ---------------------------------------------------------------------------
// Position categories (12) — mirrors the position_categories DB seed
// ---------------------------------------------------------------------------

export const POSITION_CATEGORIES: readonly PositionCategory[] = [
  { code: 'QB',  name: 'Quarterback',         unit: 'offense',        sortOrder: 1  },
  { code: 'RB',  name: 'Running Back',        unit: 'offense',        sortOrder: 2  },
  { code: 'WR',  name: 'Wide Receiver',       unit: 'offense',        sortOrder: 3  },
  { code: 'TE',  name: 'Tight End',           unit: 'offense',        sortOrder: 4  },
  { code: 'OL',  name: 'Offensive Lineman',   unit: 'offense',        sortOrder: 5  },
  { code: 'DL',  name: 'Defensive Lineman',   unit: 'defense',        sortOrder: 10 },
  { code: 'LB',  name: 'Linebacker',          unit: 'defense',        sortOrder: 11 },
  { code: 'DB',  name: 'Defensive Back',      unit: 'defense',        sortOrder: 12 },
  { code: 'K',   name: 'Kicker',              unit: 'special_teams',  sortOrder: 20 },
  { code: 'P',   name: 'Punter',              unit: 'special_teams',  sortOrder: 21 },
  { code: 'LS',  name: 'Long Snapper',        unit: 'special_teams',  sortOrder: 22 },
  { code: 'ATH', name: 'Athlete',             unit: 'flex',           sortOrder: 30 },
] as const

// ---------------------------------------------------------------------------
// Scheme templates — every slot fully defined
// ---------------------------------------------------------------------------

export const SCHEME_TEMPLATES: readonly SchemeTemplate[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // DEFENSE
  // ─────────────────────────────────────────────────────────────────────────
  {
    key: '4-3-base', name: '4-3 Base', unit: 'defense', ageGroup: 'high_school',
    description: 'Four down linemen, three linebackers, four-deep secondary.',
    slots: [
      { slotCode: 'LDE',  label: 'Left Defensive End',  category: 'DL' },
      { slotCode: 'DT1',  label: '3-Technique Tackle',  category: 'DL' },
      { slotCode: 'DT2',  label: '1-Technique Tackle',  category: 'DL' },
      { slotCode: 'RDE',  label: 'Right Defensive End', category: 'DL' },
      { slotCode: 'SAM',  label: 'Strong-Side LB (Sam)',category: 'LB' },
      { slotCode: 'MIKE', label: 'Middle LB (Mike)',    category: 'LB' },
      { slotCode: 'WILL', label: 'Weak-Side LB (Will)', category: 'LB' },
      { slotCode: 'LCB',  label: 'Left Cornerback',     category: 'DB' },
      { slotCode: 'RCB',  label: 'Right Cornerback',    category: 'DB' },
      { slotCode: 'FS',   label: 'Free Safety',         category: 'DB' },
      { slotCode: 'SS',   label: 'Strong Safety',       category: 'DB' },
    ],
  },
  {
    key: '3-4-base', name: '3-4 Base', unit: 'defense', ageGroup: 'high_school',
    description: 'Three down linemen, four linebackers — pressure flexibility.',
    slots: [
      { slotCode: 'LDE',  label: 'Left Defensive End',  category: 'DL' },
      { slotCode: 'NT',   label: 'Nose Tackle',         category: 'DL' },
      { slotCode: 'RDE',  label: 'Right Defensive End', category: 'DL' },
      { slotCode: 'LOLB', label: 'Left Outside LB',     category: 'LB' },
      { slotCode: 'LILB', label: 'Left Inside LB',      category: 'LB' },
      { slotCode: 'RILB', label: 'Right Inside LB',     category: 'LB' },
      { slotCode: 'ROLB', label: 'Right Outside LB',    category: 'LB' },
      { slotCode: 'LCB',  label: 'Left Cornerback',     category: 'DB' },
      { slotCode: 'RCB',  label: 'Right Cornerback',    category: 'DB' },
      { slotCode: 'FS',   label: 'Free Safety',         category: 'DB' },
      { slotCode: 'SS',   label: 'Strong Safety',       category: 'DB' },
    ],
  },
  {
    key: '4-2-5-nickel', name: '4-2-5 Nickel', unit: 'defense', ageGroup: 'high_school',
    description: 'Four DL, two LBs, five DBs — coverage-friendly base.',
    slots: [
      { slotCode: 'LDE',  label: 'Left Defensive End',  category: 'DL' },
      { slotCode: 'DT1',  label: '3-Technique Tackle',  category: 'DL' },
      { slotCode: 'DT2',  label: '1-Technique Tackle',  category: 'DL' },
      { slotCode: 'RDE',  label: 'Right Defensive End', category: 'DL' },
      { slotCode: 'MIKE', label: 'Middle LB',           category: 'LB' },
      { slotCode: 'WILL', label: 'Weak-Side LB',        category: 'LB' },
      { slotCode: 'LCB',  label: 'Left Cornerback',     category: 'DB' },
      { slotCode: 'RCB',  label: 'Right Cornerback',    category: 'DB' },
      { slotCode: 'NB',   label: 'Nickelback',          category: 'DB' },
      { slotCode: 'FS',   label: 'Free Safety',         category: 'DB' },
      { slotCode: 'SS',   label: 'Strong Safety',       category: 'DB' },
    ],
  },
  {
    key: '5-3-defense', name: '5-3 Defense', unit: 'defense', ageGroup: 'youth',
    description: 'Five-man front, three LBs — common at older youth levels.',
    slots: [
      { slotCode: 'LDE', label: 'Left Defensive End',  category: 'DL' },
      { slotCode: 'LDT', label: 'Left Defensive Tackle',category: 'DL' },
      { slotCode: 'NG',  label: 'Nose Guard',          category: 'DL' },
      { slotCode: 'RDT', label: 'Right Defensive Tackle',category: 'DL' },
      { slotCode: 'RDE', label: 'Right Defensive End', category: 'DL' },
      { slotCode: 'SLB', label: 'Strong-Side LB',      category: 'LB' },
      { slotCode: 'MLB', label: 'Middle LB',           category: 'LB' },
      { slotCode: 'WLB', label: 'Weak-Side LB',        category: 'LB' },
      { slotCode: 'LCB', label: 'Left Cornerback',     category: 'DB' },
      { slotCode: 'RCB', label: 'Right Cornerback',    category: 'DB' },
      { slotCode: 'FS',  label: 'Free Safety',         category: 'DB' },
    ],
  },
  {
    key: '6-2-defense', name: '6-2 Defense', unit: 'defense', ageGroup: 'youth',
    description: 'Heavy six-man front for run-first leagues.',
    slots: [
      { slotCode: 'LDE', label: 'Left Defensive End',  category: 'DL' },
      { slotCode: 'LDT', label: 'Left Defensive Tackle',category: 'DL' },
      { slotCode: 'LNG', label: 'Left Nose Guard',     category: 'DL' },
      { slotCode: 'RNG', label: 'Right Nose Guard',    category: 'DL' },
      { slotCode: 'RDT', label: 'Right Defensive Tackle',category: 'DL' },
      { slotCode: 'RDE', label: 'Right Defensive End', category: 'DL' },
      { slotCode: 'MLB', label: 'Middle LB',           category: 'LB' },
      { slotCode: 'OLB', label: 'Outside LB',          category: 'LB' },
      { slotCode: 'LCB', label: 'Left Cornerback',     category: 'DB' },
      { slotCode: 'RCB', label: 'Right Cornerback',    category: 'DB' },
      { slotCode: 'S',   label: 'Safety',              category: 'DB' },
    ],
  },
  {
    key: '3-3-stack', name: '3-3 Stack', unit: 'defense', ageGroup: 'youth',
    description: 'Three down, three stacked LBs, five-DB shell — flexible.',
    slots: [
      { slotCode: 'LDE',  label: 'Left Defensive End',  category: 'DL' },
      { slotCode: 'NT',   label: 'Nose Tackle',         category: 'DL' },
      { slotCode: 'RDE',  label: 'Right Defensive End', category: 'DL' },
      { slotCode: 'LOLB', label: 'Left Outside LB',     category: 'LB' },
      { slotCode: 'MLB',  label: 'Middle LB',           category: 'LB' },
      { slotCode: 'ROLB', label: 'Right Outside LB',    category: 'LB' },
      { slotCode: 'LCB',  label: 'Left Cornerback',     category: 'DB' },
      { slotCode: 'RCB',  label: 'Right Cornerback',    category: 'DB' },
      { slotCode: 'NB',   label: 'Nickelback',          category: 'DB' },
      { slotCode: 'FS',   label: 'Free Safety',         category: 'DB' },
      { slotCode: 'SS',   label: 'Strong Safety',       category: 'DB' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // OFFENSE
  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'i-formation', name: 'I-Formation', unit: 'offense', ageGroup: 'all',
    description: 'Classic two-back set with FB-RB stack behind QB.',
    slots: [
      { slotCode: 'LT',  label: 'Left Tackle',  category: 'OL' },
      { slotCode: 'LG',  label: 'Left Guard',   category: 'OL' },
      { slotCode: 'C',   label: 'Center',       category: 'OL' },
      { slotCode: 'RG',  label: 'Right Guard',  category: 'OL' },
      { slotCode: 'RT',  label: 'Right Tackle', category: 'OL' },
      { slotCode: 'TE',  label: 'Tight End',    category: 'TE' },
      { slotCode: 'QB',  label: 'Quarterback',  category: 'QB' },
      { slotCode: 'FB',  label: 'Fullback',     category: 'RB' },
      { slotCode: 'RB',  label: 'Running Back', category: 'RB' },
      { slotCode: 'X',   label: 'Split End (X)', category: 'WR' },
      { slotCode: 'Z',   label: 'Flanker (Z)',  category: 'WR' },
    ],
  },
  {
    key: 'shotgun-spread', name: 'Shotgun Spread', unit: 'offense', ageGroup: 'high_school',
    description: 'QB in shotgun, four wide receivers, single RB.',
    slots: [
      { slotCode: 'LT',     label: 'Left Tackle',       category: 'OL' },
      { slotCode: 'LG',     label: 'Left Guard',        category: 'OL' },
      { slotCode: 'C',      label: 'Center',            category: 'OL' },
      { slotCode: 'RG',     label: 'Right Guard',       category: 'OL' },
      { slotCode: 'RT',     label: 'Right Tackle',      category: 'OL' },
      { slotCode: 'QB',     label: 'Quarterback',       category: 'QB' },
      { slotCode: 'RB',     label: 'Running Back',      category: 'RB' },
      { slotCode: 'X',      label: 'Split End (X)',     category: 'WR' },
      { slotCode: 'Z',      label: 'Flanker (Z)',       category: 'WR' },
      { slotCode: 'SLOT-L', label: 'Slot Left',         category: 'WR' },
      { slotCode: 'SLOT-R', label: 'Slot Right',        category: 'WR' },
    ],
  },
  {
    key: 'pistol', name: 'Pistol', unit: 'offense', ageGroup: 'high_school',
    description: 'QB in pistol depth, RB stacked behind, balanced sets.',
    slots: [
      { slotCode: 'LT',   label: 'Left Tackle',  category: 'OL' },
      { slotCode: 'LG',   label: 'Left Guard',   category: 'OL' },
      { slotCode: 'C',    label: 'Center',       category: 'OL' },
      { slotCode: 'RG',   label: 'Right Guard',  category: 'OL' },
      { slotCode: 'RT',   label: 'Right Tackle', category: 'OL' },
      { slotCode: 'TE',   label: 'Tight End',    category: 'TE' },
      { slotCode: 'QB',   label: 'Quarterback',  category: 'QB' },
      { slotCode: 'RB',   label: 'Running Back', category: 'RB' },
      { slotCode: 'X',    label: 'Split End (X)',category: 'WR' },
      { slotCode: 'Z',    label: 'Flanker (Z)',  category: 'WR' },
      { slotCode: 'SLOT', label: 'Slot Receiver',category: 'WR' },
    ],
  },
  {
    key: 'wing-t', name: 'Wing-T', unit: 'offense', ageGroup: 'youth',
    description: 'Misdirection-heavy youth offense with HB, FB, wingback.',
    slots: [
      { slotCode: 'LT', label: 'Left Tackle',  category: 'OL' },
      { slotCode: 'LG', label: 'Left Guard',   category: 'OL' },
      { slotCode: 'C',  label: 'Center',       category: 'OL' },
      { slotCode: 'RG', label: 'Right Guard',  category: 'OL' },
      { slotCode: 'RT', label: 'Right Tackle', category: 'OL' },
      { slotCode: 'TE', label: 'Tight End',    category: 'TE' },
      { slotCode: 'QB', label: 'Quarterback',  category: 'QB' },
      { slotCode: 'FB', label: 'Fullback',     category: 'RB' },
      { slotCode: 'HB', label: 'Halfback',     category: 'RB' },
      { slotCode: 'WB', label: 'Wingback',     category: 'RB' },
      { slotCode: 'SE', label: 'Split End',    category: 'WR' },
    ],
  },
  {
    key: 'spread-2x2', name: 'Spread 2x2', unit: 'offense', ageGroup: 'all',
    description: 'Two receivers each side, single back, no TE.',
    slots: [
      { slotCode: 'LT',     label: 'Left Tackle',     category: 'OL' },
      { slotCode: 'LG',     label: 'Left Guard',      category: 'OL' },
      { slotCode: 'C',      label: 'Center',          category: 'OL' },
      { slotCode: 'RG',     label: 'Right Guard',     category: 'OL' },
      { slotCode: 'RT',     label: 'Right Tackle',    category: 'OL' },
      { slotCode: 'QB',     label: 'Quarterback',     category: 'QB' },
      { slotCode: 'RB',     label: 'Running Back',    category: 'RB' },
      { slotCode: 'WR-LO',  label: 'WR Left Outside', category: 'WR' },
      { slotCode: 'WR-LI',  label: 'WR Left Inside',  category: 'WR' },
      { slotCode: 'WR-RO',  label: 'WR Right Outside',category: 'WR' },
      { slotCode: 'WR-RI',  label: 'WR Right Inside', category: 'WR' },
    ],
  },
  {
    key: 'single-back', name: 'Single Back', unit: 'offense', ageGroup: 'all',
    description: 'One back, one TE, three receivers — balanced personnel.',
    slots: [
      { slotCode: 'LT',   label: 'Left Tackle',  category: 'OL' },
      { slotCode: 'LG',   label: 'Left Guard',   category: 'OL' },
      { slotCode: 'C',    label: 'Center',       category: 'OL' },
      { slotCode: 'RG',   label: 'Right Guard',  category: 'OL' },
      { slotCode: 'RT',   label: 'Right Tackle', category: 'OL' },
      { slotCode: 'TE',   label: 'Tight End',    category: 'TE' },
      { slotCode: 'QB',   label: 'Quarterback',  category: 'QB' },
      { slotCode: 'RB',   label: 'Running Back', category: 'RB' },
      { slotCode: 'X',    label: 'Split End (X)',category: 'WR' },
      { slotCode: 'Z',    label: 'Flanker (Z)',  category: 'WR' },
      { slotCode: 'SLOT', label: 'Slot Receiver',category: 'WR' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SPECIAL TEAMS
  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'kickoff-coverage', name: 'Kickoff Coverage', unit: 'special_teams', ageGroup: 'all',
    description: 'K plus 10 cover men with two outside gunners.',
    slots: [
      { slotCode: 'K',       label: 'Kicker',          category: 'K'   },
      { slotCode: 'GUN-L',   label: 'Left Gunner',     category: 'ATH' },
      { slotCode: 'COV-L4',  label: 'Cover L4',        category: 'ATH' },
      { slotCode: 'COV-L3',  label: 'Cover L3',        category: 'ATH' },
      { slotCode: 'COV-L2',  label: 'Cover L2',        category: 'ATH' },
      { slotCode: 'COV-L1',  label: 'Cover L1',        category: 'ATH' },
      { slotCode: 'COV-R1',  label: 'Cover R1',        category: 'ATH' },
      { slotCode: 'COV-R2',  label: 'Cover R2',        category: 'ATH' },
      { slotCode: 'COV-R3',  label: 'Cover R3',        category: 'ATH' },
      { slotCode: 'COV-R4',  label: 'Cover R4',        category: 'ATH' },
      { slotCode: 'GUN-R',   label: 'Right Gunner',    category: 'ATH' },
    ],
  },
  {
    key: 'kickoff-return', name: 'Kickoff Return', unit: 'special_teams', ageGroup: 'all',
    description: 'KR with front-line blockers, wedge, and a safety returner.',
    slots: [
      { slotCode: 'KR',      label: 'Kick Returner',   category: 'ATH' },
      { slotCode: 'KR2',     label: 'Second Returner', category: 'ATH', optional: true },
      { slotCode: 'WEDGE-L', label: 'Wedge Left',      category: 'ATH' },
      { slotCode: 'WEDGE-R', label: 'Wedge Right',     category: 'ATH' },
      { slotCode: 'MID-L',   label: 'Mid Blocker L',   category: 'ATH' },
      { slotCode: 'MID-R',   label: 'Mid Blocker R',   category: 'ATH' },
      { slotCode: 'FRONT-L2',label: 'Front Line L Out',category: 'ATH' },
      { slotCode: 'FRONT-L1',label: 'Front Line L In', category: 'ATH' },
      { slotCode: 'FRONT-R1',label: 'Front Line R In', category: 'ATH' },
      { slotCode: 'FRONT-R2',label: 'Front Line R Out',category: 'ATH' },
      { slotCode: 'JAM-L',   label: 'Jammer Left',     category: 'ATH' },
      { slotCode: 'JAM-R',   label: 'Jammer Right',    category: 'ATH' },
    ],
  },
  {
    key: 'punt', name: 'Punt', unit: 'special_teams', ageGroup: 'all',
    description: 'Standard punt unit with shield protection and gunners.',
    slots: [
      { slotCode: 'LS',     label: 'Long Snapper',     category: 'LS'  },
      { slotCode: 'LT',     label: 'Left Tackle',      category: 'OL'  },
      { slotCode: 'LG',     label: 'Left Guard',       category: 'OL'  },
      { slotCode: 'RG',     label: 'Right Guard',      category: 'OL'  },
      { slotCode: 'RT',     label: 'Right Tackle',     category: 'OL'  },
      { slotCode: 'LWING',  label: 'Left Wing',        category: 'ATH' },
      { slotCode: 'RWING',  label: 'Right Wing',       category: 'ATH' },
      { slotCode: 'PP',     label: 'Personal Protector',category: 'ATH'},
      { slotCode: 'P',      label: 'Punter',           category: 'P'   },
      { slotCode: 'GUN-L',  label: 'Left Gunner',      category: 'ATH' },
      { slotCode: 'GUN-R',  label: 'Right Gunner',     category: 'ATH' },
    ],
  },
  {
    key: 'punt-return', name: 'Punt Return', unit: 'special_teams', ageGroup: 'all',
    description: 'PR with rush-or-return alignment and two jammers.',
    slots: [
      { slotCode: 'PR',     label: 'Punt Returner',    category: 'ATH' },
      { slotCode: 'JAM-L',  label: 'Jammer Left',      category: 'ATH' },
      { slotCode: 'JAM-R',  label: 'Jammer Right',     category: 'ATH' },
      { slotCode: 'RUSH-L1',label: 'Edge Rush Left',   category: 'ATH' },
      { slotCode: 'RUSH-L2',label: 'Inside Rush Left', category: 'ATH' },
      { slotCode: 'RUSH-M', label: 'Middle Rush',      category: 'ATH' },
      { slotCode: 'RUSH-R2',label: 'Inside Rush Right',category: 'ATH' },
      { slotCode: 'RUSH-R1',label: 'Edge Rush Right',  category: 'ATH' },
      { slotCode: 'HOLD-L', label: 'Hold-up Left',     category: 'ATH' },
      { slotCode: 'HOLD-R', label: 'Hold-up Right',    category: 'ATH' },
      { slotCode: 'BLOCK',  label: 'Lead Blocker',     category: 'ATH' },
    ],
  },
  {
    key: 'fg-extra-point', name: 'FG / Extra Point', unit: 'special_teams', ageGroup: 'all',
    description: 'Field goal / extra point unit with holder and wings.',
    slots: [
      { slotCode: 'LS',    label: 'Long Snapper',      category: 'LS'  },
      { slotCode: 'LT',    label: 'Left Tackle',       category: 'OL'  },
      { slotCode: 'LG',    label: 'Left Guard',        category: 'OL'  },
      { slotCode: 'RG',    label: 'Right Guard',       category: 'OL'  },
      { slotCode: 'RT',    label: 'Right Tackle',      category: 'OL'  },
      { slotCode: 'LWING', label: 'Left Wing',         category: 'ATH' },
      { slotCode: 'RWING', label: 'Right Wing',        category: 'ATH' },
      { slotCode: 'LE',    label: 'Left End',          category: 'TE'  },
      { slotCode: 'RE',    label: 'Right End',         category: 'TE'  },
      { slotCode: 'H',     label: 'Holder',            category: 'ATH' },
      { slotCode: 'K',     label: 'Kicker',            category: 'K'   },
    ],
  },
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getCategory(code: string): PositionCategory | undefined {
  return POSITION_CATEGORIES.find((c) => c.code === code)
}

export function getCategoriesForUnit(unit: PositionUnit): PositionCategory[] {
  return POSITION_CATEGORIES.filter((c) => c.unit === unit)
}

export function getSchemeTemplate(key: string): SchemeTemplate | undefined {
  return SCHEME_TEMPLATES.find((t) => t.key === key)
}

export function categoryFromSlot(templateKey: string, slotCode: string): string | null {
  const template = getSchemeTemplate(templateKey)
  return template?.slots.find((s) => s.slotCode === slotCode)?.category ?? null
}

export function getSchemesForUnit(
  unit: SchemeUnit,
  ageGroup: 'youth' | 'high_school',
): SchemeTemplate[] {
  return SCHEME_TEMPLATES.filter(
    (t) => t.unit === unit && (t.ageGroup === 'all' || t.ageGroup === ageGroup),
  )
}

/** Pick the system template that should be the team's default for a given unit + age group. */
export function defaultSchemeKey(
  unit: SchemeUnit,
  ageGroup: 'youth' | 'high_school',
): string {
  if (unit === 'defense')        return ageGroup === 'youth' ? '5-3-defense' : '4-3-base'
  if (unit === 'offense')        return ageGroup === 'youth' ? 'wing-t'      : 'i-formation'
  return 'kickoff-coverage'
}

/** Maps a team.level string ("Youth", "High School", etc.) to the template ageGroup axis. */
export function ageGroupFromLevel(level: string | null | undefined): 'youth' | 'high_school' {
  const normalized = (level ?? '').toLowerCase()
  if (normalized.includes('youth') || normalized.includes('middle') || normalized.includes('elementary')) {
    return 'youth'
  }
  return 'high_school'
}
