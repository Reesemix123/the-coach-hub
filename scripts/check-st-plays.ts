import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bawcgmongnswmrxfsweh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhd2NnbW9uZ25zd21yeGZzd2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTI4MzAsImV4cCI6MjA2NDA4ODgzMH0.hN8_Vgm5GxSVazYYIITjsHAR-7lZQKz5R6jqqXCPGQ0'
);

async function checkPlays() {
  // Get all plays and check their odk values
  const { data: allPlays, error } = await supabase
    .from('playbook_plays')
    .select('play_code, play_name, attributes')
    .limit(200);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total plays fetched:', allPlays?.length);

  // Group by odk
  const odkCounts: Record<string, number> = {};
  const stPlays: any[] = [];

  for (const play of allPlays || []) {
    const odk = play.attributes?.odk || 'undefined';
    odkCounts[odk] = (odkCounts[odk] || 0) + 1;

    if (odk === 'special_teams' || odk === 'specialTeams') {
      stPlays.push({
        code: play.play_code,
        name: play.play_name,
        odk: play.attributes?.odk,
        formation: play.attributes?.formation,
        unit: play.attributes?.unit
      });
    }
  }

  console.log('\nODK distribution:', odkCounts);
  console.log('\nSpecial Teams plays:', stPlays.length);
  if (stPlays.length > 0) {
    console.log('ST Play examples:');
    stPlays.slice(0, 10).forEach(p => console.log(p));
  }

  // Also show some sample plays to see structure
  console.log('\nSample play attributes (first 3):');
  allPlays?.slice(0, 3).forEach(p => {
    console.log({
      code: p.play_code,
      odk: p.attributes?.odk,
      formation: p.attributes?.formation
    });
  });
}

checkPlays();
