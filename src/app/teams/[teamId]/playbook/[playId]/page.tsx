// src/app/teams/[teamId]/playbook/[playId]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import PlayBuilder from '@/components/playbuilder/PlayBuilder';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { PlayAttributes, PlayDiagram } from '@/types/football';

interface Team {
  id: string;
  name: string;
  level: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
}

interface PlaybookPlay {
  id: string;
  play_code: string;
  play_name: string;
  attributes: PlayAttributes;
  diagram: PlayDiagram;
}

export default function EditPlayPage({ params }: { params: Promise<{ teamId: string; playId: string }> }) {
  const { teamId, playId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [play, setPlay] = useState<PlaybookPlay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [teamId, playId]);

  async function fetchData() {
    try {
      // Fetch team
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Fetch play
      const { data: playData, error: playError } = await supabase
        .from('playbook_plays')
        .select('*')
        .eq('id', playId)
        .single();

      if (playError) {
        if (playError.code === 'PGRST116') {
          setError('Play not found');
        } else {
          throw playError;
        }
        return;
      }

      setPlay(playData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error loading play');
    } finally {
      setLoading(false);
    }
  }

  const handleSave = () => {
    // Redirect back to playbook after save
    router.push(`/teams/${teamId}/playbook`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading play...</div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">{error || 'Team not found'}</div>
          <button
            onClick={() => router.push(`/teams/${teamId}/playbook`)}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Back to Playbook
          </button>
        </div>
      </div>
    );
  }

  if (!play) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">Play not found</div>
          <button
            onClick={() => router.push(`/teams/${teamId}/playbook`)}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Back to Playbook
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <ErrorBoundary>
        <PlayBuilder
          teamId={teamId}
          teamName={team.name}
          existingPlay={play}
          onSave={handleSave}
        />
      </ErrorBoundary>
    </div>
  );
}
