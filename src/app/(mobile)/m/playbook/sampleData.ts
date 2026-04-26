/**
 * Sample plays shown when the coach has an empty playbook.
 * Matches the Play interface used by the playbook page.
 */

interface SamplePlay {
  id: string
  play_code: string
  play_name: string
  attributes: {
    odk: 'offense' | 'defense' | 'specialTeams'
    formation?: string
    playType?: string
    direction?: string
    personnel?: string
  }
  is_archived: boolean
  call_number?: number | null
  isSample: true
}

export const SAMPLE_PLAYS: SamplePlay[] = [
  {
    id: 'sample-1',
    play_code: 'S-001',
    play_name: 'Sample: Inside Zone',
    attributes: {
      odk: 'offense',
      formation: 'I Formation',
      playType: 'run',
      direction: 'right',
      personnel: '21',
    },
    is_archived: false,
    call_number: 1,
    isSample: true,
  },
  {
    id: 'sample-2',
    play_code: 'S-002',
    play_name: 'Sample: Counter',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'run',
      direction: 'left',
      personnel: '11',
    },
    is_archived: false,
    call_number: 2,
    isSample: true,
  },
  {
    id: 'sample-3',
    play_code: 'S-003',
    play_name: 'Sample: PA Boot',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Twins',
      playType: 'pass',
      direction: 'right',
      personnel: '11',
    },
    is_archived: false,
    call_number: 3,
    isSample: true,
  },
  {
    id: 'sample-4',
    play_code: 'S-004',
    play_name: 'Sample: 4 Verticals',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'pass',
      personnel: '10',
    },
    is_archived: false,
    call_number: 4,
    isSample: true,
  },
]
