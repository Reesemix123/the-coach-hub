/**
 * Script to calculate expected analytics values from test data
 * Run with: npx tsx scripts/expected-analytics-values.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bawcgmongnswmrxfsweh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhd2NnbW9uZ25zd21yeGZzd2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTI4MzAsImV4cCI6MjA2NDA4ODgzMH0.hN8_Vgm5GxSVazYYIITjsHAR-7lZQKz5R6jqqXCPGQ0'
);

const TEAM_ID = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

async function main() {
  console.log('='.repeat(80));
  console.log('EXPECTED ANALYTICS VALUES FROM TEST DATA');
  console.log('='.repeat(80));
  console.log(`\nTeam ID: ${TEAM_ID}\n`);

  // ============================================
  // OFFENSIVE REPORT - QB Stats
  // ============================================
  console.log('\n' + '='.repeat(40));
  console.log('OFFENSIVE REPORT - QB Stats Section');
  console.log('='.repeat(40));

  const { data: passPlays } = await supabase
    .from('play_instances')
    .select(`
      id,
      qb_id,
      is_complete,
      is_interception,
      yards_gained,
      is_touchdown,
      is_sack,
      players!qb_id (first_name, last_name, jersey_number)
    `)
    .eq('team_id', TEAM_ID)
    .not('qb_id', 'is', null);

  if (passPlays && passPlays.length > 0) {
    // Group by QB
    const qbStats: Record<string, any> = {};
    passPlays.forEach((play: any) => {
      const qbName = play.players ? `${play.players.first_name} ${play.players.last_name}` : 'Unknown';
      const jersey = play.players?.jersey_number || '';
      if (!qbStats[play.qb_id]) {
        qbStats[play.qb_id] = {
          name: qbName,
          jersey,
          attempts: 0,
          completions: 0,
          yards: 0,
          touchdowns: 0,
          interceptions: 0,
          sacks: 0
        };
      }
      const qs = qbStats[play.qb_id];
      qs.attempts++;
      if (play.is_complete) qs.completions++;
      if (play.is_interception) qs.interceptions++;
      if (play.is_touchdown && play.is_complete) qs.touchdowns++;
      if (play.is_sack) qs.sacks++;
      if (play.is_complete) qs.yards += play.yards_gained || 0;
    });

    Object.values(qbStats).forEach((qs: any) => {
      const compPct = qs.attempts > 0 ? ((qs.completions / qs.attempts) * 100).toFixed(1) : '0.0';
      console.log(`\n  QB: #${qs.jersey} ${qs.name}`);
      console.log(`    Completions: ${qs.completions}/${qs.attempts} (${compPct}%)`);
      console.log(`    Passing Yards: ${qs.yards}`);
      console.log(`    Passing TDs: ${qs.touchdowns}`);
      console.log(`    Interceptions: ${qs.interceptions}`);
      console.log(`    Sacks: ${qs.sacks}`);
    });
  } else {
    console.log('  No QB data found');
  }

  // ============================================
  // OFFENSIVE REPORT - RB Stats
  // ============================================
  console.log('\n' + '='.repeat(40));
  console.log('OFFENSIVE REPORT - RB Stats Section');
  console.log('='.repeat(40));

  const { data: rushPlays } = await supabase
    .from('play_instances')
    .select(`
      id,
      ball_carrier_id,
      yards_gained,
      is_touchdown,
      players!ball_carrier_id (first_name, last_name, jersey_number, primary_position)
    `)
    .eq('team_id', TEAM_ID)
    .not('ball_carrier_id', 'is', null);

  if (rushPlays && rushPlays.length > 0) {
    const rbStats: Record<string, any> = {};
    rushPlays.forEach((play: any) => {
      if (!play.players) return;
      const pos = play.players.primary_position;
      // Only RBs
      if (pos !== 'RB') return;

      const name = `${play.players.first_name} ${play.players.last_name}`;
      const jersey = play.players.jersey_number || '';
      if (!rbStats[play.ball_carrier_id]) {
        rbStats[play.ball_carrier_id] = {
          name,
          jersey,
          carries: 0,
          yards: 0,
          touchdowns: 0,
          explosiveRuns: 0
        };
      }
      const rs = rbStats[play.ball_carrier_id];
      rs.carries++;
      rs.yards += play.yards_gained || 0;
      if (play.is_touchdown) rs.touchdowns++;
      if ((play.yards_gained || 0) >= 10) rs.explosiveRuns++;
    });

    Object.values(rbStats).forEach((rs: any) => {
      const ypc = rs.carries > 0 ? (rs.yards / rs.carries).toFixed(1) : '0.0';
      console.log(`\n  RB: #${rs.jersey} ${rs.name}`);
      console.log(`    Carries: ${rs.carries}`);
      console.log(`    Rushing Yards: ${rs.yards}`);
      console.log(`    YPC: ${ypc}`);
      console.log(`    Rushing TDs: ${rs.touchdowns}`);
      console.log(`    Explosive Runs (10+): ${rs.explosiveRuns}`);
    });
  } else {
    console.log('  No RB data found');
  }

  // ============================================
  // OFFENSIVE REPORT - WR/TE Stats
  // ============================================
  console.log('\n' + '='.repeat(40));
  console.log('OFFENSIVE REPORT - WR/TE Stats Section');
  console.log('='.repeat(40));

  const { data: targetPlays } = await supabase
    .from('play_instances')
    .select(`
      id,
      target_id,
      is_complete,
      yards_gained,
      is_touchdown,
      players!target_id (first_name, last_name, jersey_number, primary_position)
    `)
    .eq('team_id', TEAM_ID)
    .not('target_id', 'is', null);

  if (targetPlays && targetPlays.length > 0) {
    const wrteStats: Record<string, any> = {};
    targetPlays.forEach((play: any) => {
      if (!play.players) return;
      const pos = play.players.primary_position;
      // Only WR and TE
      if (pos !== 'WR' && pos !== 'TE') return;

      const name = `${play.players.first_name} ${play.players.last_name}`;
      const jersey = play.players.jersey_number || '';
      if (!wrteStats[play.target_id]) {
        wrteStats[play.target_id] = {
          name,
          jersey,
          position: pos,
          targets: 0,
          receptions: 0,
          yards: 0,
          touchdowns: 0,
          explosiveCatches: 0
        };
      }
      const ws = wrteStats[play.target_id];
      ws.targets++;
      if (play.is_complete) {
        ws.receptions++;
        ws.yards += play.yards_gained || 0;
        if (play.is_touchdown) ws.touchdowns++;
        if ((play.yards_gained || 0) >= 15) ws.explosiveCatches++;
      }
    });

    Object.values(wrteStats).forEach((ws: any) => {
      const catchRate = ws.targets > 0 ? ((ws.receptions / ws.targets) * 100).toFixed(1) : '0.0';
      const ypr = ws.receptions > 0 ? (ws.yards / ws.receptions).toFixed(1) : '0.0';
      console.log(`\n  ${ws.position}: #${ws.jersey} ${ws.name}`);
      console.log(`    Targets: ${ws.targets}`);
      console.log(`    Receptions: ${ws.receptions}`);
      console.log(`    Catch %: ${catchRate}%`);
      console.log(`    Receiving Yards: ${ws.yards}`);
      console.log(`    YPR: ${ypr}`);
      console.log(`    Receiving TDs: ${ws.touchdowns}`);
      console.log(`    Explosive Catches (15+): ${ws.explosiveCatches}`);
    });
  } else {
    console.log('  No WR/TE data found');
  }

  // ============================================
  // OFFENSIVE REPORT - OL Performance
  // ============================================
  console.log('\n' + '='.repeat(40));
  console.log('OFFENSIVE REPORT - OL Performance Section');
  console.log('='.repeat(40));

  const { data: olData } = await supabase
    .from('player_participation')
    .select(`
      player_id,
      participation_type,
      result,
      players (first_name, last_name, jersey_number, primary_position)
    `)
    .in('participation_type', ['ol_lt', 'ol_lg', 'ol_c', 'ol_rg', 'ol_rt']);

  if (olData && olData.length > 0) {
    const olStats: Record<string, any> = {};
    olData.forEach((record: any) => {
      if (!record.players) return;
      const name = `${record.players.first_name} ${record.players.last_name}`;
      const jersey = record.players.jersey_number || '';
      const posMap: Record<string, string> = {
        'ol_lt': 'LT', 'ol_lg': 'LG', 'ol_c': 'C', 'ol_rg': 'RG', 'ol_rt': 'RT'
      };
      const pos = posMap[record.participation_type];

      if (!olStats[record.player_id]) {
        olStats[record.player_id] = {
          name,
          jersey,
          position: pos,
          assignments: 0,
          wins: 0,
          losses: 0
        };
      }
      const os = olStats[record.player_id];
      os.assignments++;
      if (record.result === 'win') os.wins++;
      if (record.result === 'loss') os.losses++;
    });

    // Sort by position
    const posOrder = ['LT', 'LG', 'C', 'RG', 'RT'];
    const sorted = Object.values(olStats).sort((a: any, b: any) =>
      posOrder.indexOf(a.position) - posOrder.indexOf(b.position)
    );

    sorted.forEach((os: any) => {
      const winRate = os.assignments > 0 ? ((os.wins / os.assignments) * 100).toFixed(1) : '0.0';
      console.log(`\n  ${os.position}: #${os.jersey} ${os.name}`);
      console.log(`    Assignments: ${os.assignments}`);
      console.log(`    Block Wins: ${os.wins}`);
      console.log(`    Block Losses: ${os.losses}`);
      console.log(`    Win Rate: ${winRate}%`);
    });
  } else {
    console.log('  No OL data found');
  }

  // ============================================
  // DEFENSIVE REPORT - DL Stats
  // ============================================
  console.log('\n' + '='.repeat(40));
  console.log('DEFENSIVE REPORT - DL Stats Section');
  console.log('='.repeat(40));

  const { data: dlData } = await supabase
    .from('player_participation')
    .select(`
      player_id,
      participation_type,
      result,
      players!inner (first_name, last_name, jersey_number, primary_position)
    `)
    .in('players.primary_position', ['DE', 'DT', 'NT', 'DL']);

  if (dlData && dlData.length > 0) {
    const dlStats: Record<string, any> = {};
    dlData.forEach((record: any) => {
      if (!record.players) return;
      const name = `${record.players.first_name} ${record.players.last_name}`;
      const jersey = record.players.jersey_number || '';
      const pos = record.players.primary_position;

      if (!dlStats[record.player_id]) {
        dlStats[record.player_id] = {
          name,
          jersey,
          position: pos,
          primaryTackles: 0,
          assistTackles: 0,
          totalTackles: 0,
          missedTackles: 0,
          tfls: 0,
          sacks: 0,
          pressures: 0,
          forcedFumbles: 0,
          havocPlays: 0
        };
      }
      const ds = dlStats[record.player_id];

      switch (record.participation_type) {
        case 'primary_tackle':
          ds.primaryTackles++;
          ds.totalTackles++;
          break;
        case 'assist_tackle':
          ds.assistTackles++;
          ds.totalTackles++;
          break;
        case 'missed_tackle':
          ds.missedTackles++;
          break;
        case 'tackle_for_loss':
          ds.tfls++;
          ds.havocPlays++;
          break;
        case 'pressure':
          ds.pressures++;
          if (record.result === 'sack') {
            ds.sacks++;
            ds.havocPlays++;
          }
          break;
        case 'forced_fumble':
          ds.forcedFumbles++;
          ds.havocPlays++;
          break;
      }
    });

    Object.values(dlStats).forEach((ds: any) => {
      console.log(`\n  ${ds.position}: #${ds.jersey} ${ds.name}`);
      console.log(`    Tackles: ${ds.totalTackles} (Solo: ${ds.primaryTackles}, Ast: ${ds.assistTackles})`);
      console.log(`    Missed Tackles: ${ds.missedTackles}`);
      console.log(`    TFLs: ${ds.tfls}`);
      console.log(`    Sacks: ${ds.sacks}`);
      console.log(`    Pressures: ${ds.pressures}`);
      console.log(`    Forced Fumbles: ${ds.forcedFumbles}`);
      console.log(`    Havoc Plays: ${ds.havocPlays}`);
    });
  } else {
    console.log('  No DL data found');
  }

  // ============================================
  // DEFENSIVE REPORT - LB Stats
  // ============================================
  console.log('\n' + '='.repeat(40));
  console.log('DEFENSIVE REPORT - LB Stats Section');
  console.log('='.repeat(40));

  const { data: lbData } = await supabase
    .from('player_participation')
    .select(`
      player_id,
      participation_type,
      result,
      players!inner (first_name, last_name, jersey_number, primary_position)
    `)
    .in('players.primary_position', ['LB', 'MLB', 'ILB', 'OLB', 'MIKE', 'WILL', 'SAM']);

  if (lbData && lbData.length > 0) {
    const lbStats: Record<string, any> = {};
    lbData.forEach((record: any) => {
      if (!record.players) return;
      const name = `${record.players.first_name} ${record.players.last_name}`;
      const jersey = record.players.jersey_number || '';
      const pos = record.players.primary_position;

      if (!lbStats[record.player_id]) {
        lbStats[record.player_id] = {
          name,
          jersey,
          position: pos,
          primaryTackles: 0,
          assistTackles: 0,
          totalTackles: 0,
          missedTackles: 0,
          tfls: 0,
          sacks: 0,
          pressures: 0,
          coverageSnaps: 0,
          interceptions: 0,
          pbus: 0,
          forcedFumbles: 0,
          havocPlays: 0
        };
      }
      const ls = lbStats[record.player_id];

      switch (record.participation_type) {
        case 'primary_tackle':
          ls.primaryTackles++;
          ls.totalTackles++;
          break;
        case 'assist_tackle':
          ls.assistTackles++;
          ls.totalTackles++;
          break;
        case 'missed_tackle':
          ls.missedTackles++;
          break;
        case 'tackle_for_loss':
          ls.tfls++;
          ls.havocPlays++;
          break;
        case 'pressure':
          ls.pressures++;
          if (record.result === 'sack') {
            ls.sacks++;
            ls.havocPlays++;
          }
          break;
        case 'coverage_assignment':
          ls.coverageSnaps++;
          break;
        case 'interception':
          ls.interceptions++;
          ls.havocPlays++;
          break;
        case 'pass_breakup':
          ls.pbus++;
          ls.havocPlays++;
          break;
        case 'forced_fumble':
          ls.forcedFumbles++;
          ls.havocPlays++;
          break;
      }
    });

    Object.values(lbStats).forEach((ls: any) => {
      console.log(`\n  ${ls.position}: #${ls.jersey} ${ls.name}`);
      console.log(`    Tackles: ${ls.totalTackles} (Solo: ${ls.primaryTackles}, Ast: ${ls.assistTackles})`);
      console.log(`    Missed Tackles: ${ls.missedTackles}`);
      console.log(`    TFLs: ${ls.tfls}`);
      console.log(`    Sacks: ${ls.sacks}`);
      console.log(`    Pressures: ${ls.pressures}`);
      console.log(`    Coverage Snaps: ${ls.coverageSnaps}`);
      console.log(`    INTs: ${ls.interceptions}`);
      console.log(`    PBUs: ${ls.pbus}`);
      console.log(`    Forced Fumbles: ${ls.forcedFumbles}`);
      console.log(`    Havoc Plays: ${ls.havocPlays}`);
    });
  } else {
    console.log('  No LB data found');
  }

  // ============================================
  // DEFENSIVE REPORT - DB Stats
  // ============================================
  console.log('\n' + '='.repeat(40));
  console.log('DEFENSIVE REPORT - DB Stats Section');
  console.log('='.repeat(40));

  const { data: dbData } = await supabase
    .from('player_participation')
    .select(`
      player_id,
      participation_type,
      result,
      players!inner (first_name, last_name, jersey_number, primary_position)
    `)
    .in('players.primary_position', ['CB', 'S', 'FS', 'SS', 'DB']);

  if (dbData && dbData.length > 0) {
    const dbStats: Record<string, any> = {};
    dbData.forEach((record: any) => {
      if (!record.players) return;
      const name = `${record.players.first_name} ${record.players.last_name}`;
      const jersey = record.players.jersey_number || '';
      const pos = record.players.primary_position;

      if (!dbStats[record.player_id]) {
        dbStats[record.player_id] = {
          name,
          jersey,
          position: pos,
          primaryTackles: 0,
          assistTackles: 0,
          totalTackles: 0,
          missedTackles: 0,
          coverageSnaps: 0,
          interceptions: 0,
          pbus: 0,
          forcedFumbles: 0,
          havocPlays: 0
        };
      }
      const ds = dbStats[record.player_id];

      switch (record.participation_type) {
        case 'primary_tackle':
          ds.primaryTackles++;
          ds.totalTackles++;
          break;
        case 'assist_tackle':
          ds.assistTackles++;
          ds.totalTackles++;
          break;
        case 'missed_tackle':
          ds.missedTackles++;
          break;
        case 'coverage_assignment':
          ds.coverageSnaps++;
          break;
        case 'interception':
          ds.interceptions++;
          ds.havocPlays++;
          break;
        case 'pass_breakup':
          ds.pbus++;
          ds.havocPlays++;
          break;
        case 'forced_fumble':
          ds.forcedFumbles++;
          ds.havocPlays++;
          break;
      }
    });

    Object.values(dbStats).forEach((ds: any) => {
      console.log(`\n  ${ds.position}: #${ds.jersey} ${ds.name}`);
      console.log(`    Tackles: ${ds.totalTackles} (Solo: ${ds.primaryTackles}, Ast: ${ds.assistTackles})`);
      console.log(`    Missed Tackles: ${ds.missedTackles}`);
      console.log(`    Coverage Snaps: ${ds.coverageSnaps}`);
      console.log(`    INTs: ${ds.interceptions}`);
      console.log(`    PBUs: ${ds.pbus}`);
      console.log(`    Forced Fumbles: ${ds.forcedFumbles}`);
      console.log(`    Havoc Plays: ${ds.havocPlays}`);
    });
  } else {
    console.log('  No DB data found');
  }

  console.log('\n' + '='.repeat(80));
  console.log('END OF EXPECTED VALUES');
  console.log('='.repeat(80));
}

main().catch(console.error);
