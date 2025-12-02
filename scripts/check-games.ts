import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bawcgmongnswmrxfsweh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhd2NnbW9uZ25zd21yeGZzd2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTI4MzAsImV4cCI6MjA2NDA4ODgzMH0.hN8_Vgm5GxSVazYYIITjsHAR-7lZQKz5R6jqqXCPGQ0'
);

async function checkGames() {
  const { data, error } = await supabase
    .from('games')
    .select('id, name, opponent, is_opponent_game, opponent_team_name')
    .eq('team_id', '99ef9d88-454e-42bf-8f52-04d37b34a9d6')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Games:');
  data.forEach(g => {
    console.log(`- ${g.opponent}: is_opponent_game=${g.is_opponent_game}, opponent_team_name=${g.opponent_team_name}`);
  });
}

checkGames();
