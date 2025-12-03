import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Seed defensive playbook plays for testing the Game Plan Builder
 * Creates a variety of defensive schemes: base defenses, nickel, dime, blitzes, goal line
 * SECURITY: Only works on user's own teams
 */
export async function POST() {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // SECURITY: Get user's first team (not a hardcoded ID)
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);

  if (!teams?.length) {
    return NextResponse.json({ error: 'No team found for user' }, { status: 400 });
  }

  const TEAM_ID = teams[0].id;

  const results: { created: number; errors: string[] } = {
    created: 0,
    errors: []
  };

  // Generate defensive plays
  const defensivePlays = generateDefensivePlays();

  // Insert plays one by one to handle duplicates gracefully
  for (const play of defensivePlays) {
    const { error } = await supabase
      .from('playbook_plays')
      .upsert(
        {
          team_id: TEAM_ID,
          play_code: play.play_code,
          play_name: play.play_name,
          attributes: play.attributes,
          diagram: play.diagram,
          is_archived: false
        },
        { onConflict: 'play_code' }
      );

    if (error) {
      results.errors.push(`${play.play_code}: ${error.message}`);
    } else {
      results.created++;
    }
  }

  return NextResponse.json({
    success: results.errors.length === 0,
    ...results,
    totalPlays: defensivePlays.length,
    summary: {
      baseDefenses: defensivePlays.filter(p => p.attributes.playType === 'Base Defense').length,
      nickelPackages: defensivePlays.filter(p => p.attributes.playType === 'Nickel').length,
      dimePackages: defensivePlays.filter(p => p.attributes.playType === 'Dime').length,
      blitzes: defensivePlays.filter(p => p.attributes.playType === 'Blitz').length,
      goalLine: defensivePlays.filter(p => p.attributes.playType === 'Goal Line').length
    }
  });
}

function generateDefensivePlays() {
  const plays: Array<{
    play_code: string;
    play_name: string;
    attributes: {
      odk: string;
      formation: string;
      playType: string;
      coverage: string;
      front: string;
      blitz?: string;
      customTags?: string[];
    };
    diagram: {
      odk: string;
      formation: string;
      players: Array<{
        position: string;
        x: number;
        y: number;
        label: string;
      }>;
      routes: never[];
    };
  }> = [];

  // ==========================================
  // BASE 4-3 DEFENSES
  // ==========================================

  // 4-3 Cover 3
  plays.push({
    play_code: 'D-43-C3',
    play_name: '4-3 Cover 3',
    attributes: {
      odk: 'defense',
      formation: '4-3',
      playType: 'Base Defense',
      coverage: 'Cover 3',
      front: '4-3 Over'
    },
    diagram: {
      odk: 'defense',
      formation: '4-3',
      players: get43Formation(),
      routes: []
    }
  });

  // 4-3 Cover 2
  plays.push({
    play_code: 'D-43-C2',
    play_name: '4-3 Cover 2',
    attributes: {
      odk: 'defense',
      formation: '4-3',
      playType: 'Base Defense',
      coverage: 'Cover 2',
      front: '4-3 Over'
    },
    diagram: {
      odk: 'defense',
      formation: '4-3',
      players: get43Formation(),
      routes: []
    }
  });

  // 4-3 Cover 1 Man
  plays.push({
    play_code: 'D-43-C1',
    play_name: '4-3 Cover 1 Man',
    attributes: {
      odk: 'defense',
      formation: '4-3',
      playType: 'Base Defense',
      coverage: 'Cover 1 Man',
      front: '4-3 Over'
    },
    diagram: {
      odk: 'defense',
      formation: '4-3',
      players: get43Formation(),
      routes: []
    }
  });

  // 4-3 Cover 4
  plays.push({
    play_code: 'D-43-C4',
    play_name: '4-3 Cover 4 (Quarters)',
    attributes: {
      odk: 'defense',
      formation: '4-3',
      playType: 'Base Defense',
      coverage: 'Cover 4',
      front: '4-3 Over'
    },
    diagram: {
      odk: 'defense',
      formation: '4-3',
      players: get43Formation(),
      routes: []
    }
  });

  // ==========================================
  // BASE 3-4 DEFENSES
  // ==========================================

  // 3-4 Cover 3
  plays.push({
    play_code: 'D-34-C3',
    play_name: '3-4 Cover 3',
    attributes: {
      odk: 'defense',
      formation: '3-4',
      playType: 'Base Defense',
      coverage: 'Cover 3',
      front: '3-4 Base'
    },
    diagram: {
      odk: 'defense',
      formation: '3-4',
      players: get34Formation(),
      routes: []
    }
  });

  // 3-4 Cover 2
  plays.push({
    play_code: 'D-34-C2',
    play_name: '3-4 Cover 2',
    attributes: {
      odk: 'defense',
      formation: '3-4',
      playType: 'Base Defense',
      coverage: 'Cover 2',
      front: '3-4 Base'
    },
    diagram: {
      odk: 'defense',
      formation: '3-4',
      players: get34Formation(),
      routes: []
    }
  });

  // ==========================================
  // NICKEL PACKAGES (5 DBs)
  // ==========================================

  // Nickel Cover 3
  plays.push({
    play_code: 'D-NKL-C3',
    play_name: 'Nickel Cover 3',
    attributes: {
      odk: 'defense',
      formation: 'Nickel',
      playType: 'Nickel',
      coverage: 'Cover 3',
      front: 'Nickel 4-2'
    },
    diagram: {
      odk: 'defense',
      formation: 'Nickel',
      players: getNickelFormation(),
      routes: []
    }
  });

  // Nickel Cover 2 Man
  plays.push({
    play_code: 'D-NKL-C2M',
    play_name: 'Nickel Cover 2 Man',
    attributes: {
      odk: 'defense',
      formation: 'Nickel',
      playType: 'Nickel',
      coverage: 'Cover 2 Man',
      front: 'Nickel 4-2'
    },
    diagram: {
      odk: 'defense',
      formation: 'Nickel',
      players: getNickelFormation(),
      routes: []
    }
  });

  // Nickel Cover 1 Robber
  plays.push({
    play_code: 'D-NKL-ROB',
    play_name: 'Nickel Cover 1 Robber',
    attributes: {
      odk: 'defense',
      formation: 'Nickel',
      playType: 'Nickel',
      coverage: 'Cover 1 Robber',
      front: 'Nickel 4-2'
    },
    diagram: {
      odk: 'defense',
      formation: 'Nickel',
      players: getNickelFormation(),
      routes: []
    }
  });

  // ==========================================
  // DIME PACKAGES (6 DBs)
  // ==========================================

  // Dime Cover 3
  plays.push({
    play_code: 'D-DIME-C3',
    play_name: 'Dime Cover 3',
    attributes: {
      odk: 'defense',
      formation: 'Dime',
      playType: 'Dime',
      coverage: 'Cover 3',
      front: 'Dime 4-1',
      customTags: ['3rd & Long', 'Passing Down']
    },
    diagram: {
      odk: 'defense',
      formation: 'Dime',
      players: getDimeFormation(),
      routes: []
    }
  });

  // Dime Cover 4
  plays.push({
    play_code: 'D-DIME-C4',
    play_name: 'Dime Cover 4',
    attributes: {
      odk: 'defense',
      formation: 'Dime',
      playType: 'Dime',
      coverage: 'Cover 4',
      front: 'Dime 4-1',
      customTags: ['3rd & Long', 'Prevent']
    },
    diagram: {
      odk: 'defense',
      formation: 'Dime',
      players: getDimeFormation(),
      routes: []
    }
  });

  // ==========================================
  // BLITZ PACKAGES
  // ==========================================

  // Mike Blitz (4-3)
  plays.push({
    play_code: 'D-BLZ-MIKE',
    play_name: 'Mike Blitz',
    attributes: {
      odk: 'defense',
      formation: '4-3',
      playType: 'Blitz',
      coverage: 'Cover 1 Man',
      front: '4-3 Over',
      blitz: 'Mike LB A-Gap'
    },
    diagram: {
      odk: 'defense',
      formation: '4-3',
      players: get43Formation(),
      routes: []
    }
  });

  // Will Blitz (4-3)
  plays.push({
    play_code: 'D-BLZ-WILL',
    play_name: 'Will Blitz',
    attributes: {
      odk: 'defense',
      formation: '4-3',
      playType: 'Blitz',
      coverage: 'Cover 1 Man',
      front: '4-3 Over',
      blitz: 'Will LB B-Gap'
    },
    diagram: {
      odk: 'defense',
      formation: '4-3',
      players: get43Formation(),
      routes: []
    }
  });

  // Safety Blitz
  plays.push({
    play_code: 'D-BLZ-SS',
    play_name: 'Strong Safety Blitz',
    attributes: {
      odk: 'defense',
      formation: '4-3',
      playType: 'Blitz',
      coverage: 'Cover 1 Man',
      front: '4-3 Over',
      blitz: 'SS Edge'
    },
    diagram: {
      odk: 'defense',
      formation: '4-3',
      players: get43Formation(),
      routes: []
    }
  });

  // Corner Blitz
  plays.push({
    play_code: 'D-BLZ-CB',
    play_name: 'Corner Blitz',
    attributes: {
      odk: 'defense',
      formation: 'Nickel',
      playType: 'Blitz',
      coverage: 'Cover 1 Man',
      front: 'Nickel 4-2',
      blitz: 'CB Edge'
    },
    diagram: {
      odk: 'defense',
      formation: 'Nickel',
      players: getNickelFormation(),
      routes: []
    }
  });

  // Zone Blitz
  plays.push({
    play_code: 'D-BLZ-ZONE',
    play_name: 'Zone Blitz (Fire Zone)',
    attributes: {
      odk: 'defense',
      formation: '3-4',
      playType: 'Blitz',
      coverage: 'Cover 3 Fire',
      front: '3-4 Base',
      blitz: 'OLB + Seam Drop'
    },
    diagram: {
      odk: 'defense',
      formation: '3-4',
      players: get34Formation(),
      routes: []
    }
  });

  // Double A-Gap Blitz
  plays.push({
    play_code: 'D-BLZ-2A',
    play_name: 'Double A-Gap Blitz',
    attributes: {
      odk: 'defense',
      formation: 'Nickel',
      playType: 'Blitz',
      coverage: 'Cover 0',
      front: 'Nickel 4-2',
      blitz: 'Both ILBs A-Gap',
      customTags: ['3rd & Short', 'Aggressive']
    },
    diagram: {
      odk: 'defense',
      formation: 'Nickel',
      players: getNickelFormation(),
      routes: []
    }
  });

  // ==========================================
  // GOAL LINE DEFENSES
  // ==========================================

  // Goal Line 6-2
  plays.push({
    play_code: 'D-GL-62',
    play_name: 'Goal Line 6-2',
    attributes: {
      odk: 'defense',
      formation: 'Goal Line',
      playType: 'Goal Line',
      coverage: 'Cover 0 Man',
      front: '6-2 Goal Line',
      customTags: ['Red Zone', 'Short Yardage']
    },
    diagram: {
      odk: 'defense',
      formation: 'Goal Line',
      players: getGoalLineFormation(),
      routes: []
    }
  });

  // Goal Line 5-3
  plays.push({
    play_code: 'D-GL-53',
    play_name: 'Goal Line 5-3',
    attributes: {
      odk: 'defense',
      formation: 'Goal Line',
      playType: 'Goal Line',
      coverage: 'Cover 1 Man',
      front: '5-3 Goal Line',
      customTags: ['Red Zone', 'Short Yardage']
    },
    diagram: {
      odk: 'defense',
      formation: 'Goal Line',
      players: getGoalLineFormation(),
      routes: []
    }
  });

  // ==========================================
  // SPECIALTY DEFENSES
  // ==========================================

  // Bear Front
  plays.push({
    play_code: 'D-BEAR-C1',
    play_name: 'Bear Front Cover 1',
    attributes: {
      odk: 'defense',
      formation: '4-6 Bear',
      playType: 'Base Defense',
      coverage: 'Cover 1 Man',
      front: '4-6 Bear',
      customTags: ['Run Stop', 'Short Yardage']
    },
    diagram: {
      odk: 'defense',
      formation: '4-6 Bear',
      players: get43Formation(),
      routes: []
    }
  });

  // Prevent Defense
  plays.push({
    play_code: 'D-PREV',
    play_name: 'Prevent Defense',
    attributes: {
      odk: 'defense',
      formation: 'Prevent',
      playType: 'Dime',
      coverage: 'Cover 4 Deep',
      front: 'Prevent 3-1',
      customTags: ['End of Half', 'Hail Mary']
    },
    diagram: {
      odk: 'defense',
      formation: 'Prevent',
      players: getDimeFormation(),
      routes: []
    }
  });

  return plays;
}

// Formation player positions
function get43Formation() {
  return [
    // Defensive Line (4)
    { position: 'DE', x: 180, y: 170, label: 'DE' },
    { position: 'DT', x: 280, y: 170, label: 'DT' },
    { position: 'DT', x: 420, y: 170, label: 'DT' },
    { position: 'DE', x: 520, y: 170, label: 'DE' },
    // Linebackers (3)
    { position: 'WLB', x: 150, y: 120, label: 'W' },
    { position: 'MLB', x: 350, y: 120, label: 'M' },
    { position: 'SLB', x: 550, y: 120, label: 'S' },
    // Secondary (4)
    { position: 'CB', x: 80, y: 80, label: 'CB' },
    { position: 'SS', x: 250, y: 60, label: 'SS' },
    { position: 'FS', x: 450, y: 60, label: 'FS' },
    { position: 'CB', x: 620, y: 80, label: 'CB' }
  ];
}

function get34Formation() {
  return [
    // Defensive Line (3)
    { position: 'DE', x: 230, y: 170, label: 'DE' },
    { position: 'NT', x: 350, y: 170, label: 'NT' },
    { position: 'DE', x: 470, y: 170, label: 'DE' },
    // Linebackers (4)
    { position: 'OLB', x: 130, y: 140, label: 'OLB' },
    { position: 'ILB', x: 280, y: 120, label: 'ILB' },
    { position: 'ILB', x: 420, y: 120, label: 'ILB' },
    { position: 'OLB', x: 570, y: 140, label: 'OLB' },
    // Secondary (4)
    { position: 'CB', x: 80, y: 80, label: 'CB' },
    { position: 'SS', x: 250, y: 60, label: 'SS' },
    { position: 'FS', x: 450, y: 60, label: 'FS' },
    { position: 'CB', x: 620, y: 80, label: 'CB' }
  ];
}

function getNickelFormation() {
  return [
    // Defensive Line (4)
    { position: 'DE', x: 180, y: 170, label: 'DE' },
    { position: 'DT', x: 280, y: 170, label: 'DT' },
    { position: 'DT', x: 420, y: 170, label: 'DT' },
    { position: 'DE', x: 520, y: 170, label: 'DE' },
    // Linebackers (2)
    { position: 'WLB', x: 250, y: 120, label: 'W' },
    { position: 'MLB', x: 450, y: 120, label: 'M' },
    // Secondary (5 - Nickel)
    { position: 'CB', x: 80, y: 80, label: 'CB' },
    { position: 'NCB', x: 200, y: 90, label: 'NB' },
    { position: 'SS', x: 350, y: 50, label: 'SS' },
    { position: 'FS', x: 500, y: 50, label: 'FS' },
    { position: 'CB', x: 620, y: 80, label: 'CB' }
  ];
}

function getDimeFormation() {
  return [
    // Defensive Line (4)
    { position: 'DE', x: 200, y: 170, label: 'DE' },
    { position: 'DT', x: 300, y: 170, label: 'DT' },
    { position: 'DT', x: 400, y: 170, label: 'DT' },
    { position: 'DE', x: 500, y: 170, label: 'DE' },
    // Linebacker (1)
    { position: 'MLB', x: 350, y: 120, label: 'M' },
    // Secondary (6 - Dime)
    { position: 'CB', x: 80, y: 80, label: 'CB' },
    { position: 'NCB', x: 180, y: 90, label: 'NB' },
    { position: 'SS', x: 300, y: 50, label: 'SS' },
    { position: 'FS', x: 400, y: 50, label: 'FS' },
    { position: 'DB', x: 520, y: 90, label: 'DB' },
    { position: 'CB', x: 620, y: 80, label: 'CB' }
  ];
}

function getGoalLineFormation() {
  return [
    // Defensive Line (6)
    { position: 'DE', x: 130, y: 170, label: 'DE' },
    { position: 'DT', x: 230, y: 170, label: 'DT' },
    { position: 'NG', x: 330, y: 170, label: 'NG' },
    { position: 'DT', x: 430, y: 170, label: 'DT' },
    { position: 'DE', x: 530, y: 170, label: 'DE' },
    { position: 'DE', x: 580, y: 170, label: 'DE' },
    // Linebackers (2)
    { position: 'LB', x: 280, y: 130, label: 'LB' },
    { position: 'LB', x: 420, y: 130, label: 'LB' },
    // Secondary (3)
    { position: 'CB', x: 80, y: 100, label: 'CB' },
    { position: 'SS', x: 350, y: 80, label: 'SS' },
    { position: 'CB', x: 620, y: 100, label: 'CB' }
  ];
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to seed defensive playbook',
    description: 'Creates 22 defensive plays including base defenses, nickel/dime packages, blitzes, and goal line',
    plays: {
      baseDefenses: '4-3 and 3-4 with Cover 1/2/3/4',
      nickelPackages: 'Nickel with various coverages',
      dimePackages: 'Dime for passing situations',
      blitzes: 'Mike, Will, Safety, Corner, Zone, Double A-Gap',
      goalLine: '6-2 and 5-3 goal line defenses',
      specialty: 'Bear Front, Prevent'
    }
  });
}
