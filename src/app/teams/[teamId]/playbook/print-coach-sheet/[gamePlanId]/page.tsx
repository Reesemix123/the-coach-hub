'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import type { GamePlan, GamePlanPlayWithDetails, Team } from '@/types/football';

export default function PrintCoachSheetPage({
  params,
}: {
  params: { teamId: string; gamePlanId: string };
}) {
  const [team, setTeam] = useState<Team | null>(null);
  const [gamePlan, setGamePlan] = useState<GamePlan | null>(null);
  const [plays, setPlays] = useState<GamePlanPlayWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [params.gamePlanId, params.teamId]);

  async function fetchData() {
    try {
      // Fetch team
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', params.teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Fetch game plan
      const { data: gamePlanData, error: gamePlanError } = await supabase
        .from('game_plans')
        .select('*')
        .eq('id', params.gamePlanId)
        .single();

      if (gamePlanError) throw gamePlanError;
      setGamePlan(gamePlanData);

      // Fetch plays
      const { data: playsData, error: playsError } = await supabase
        .from('game_plan_plays')
        .select('*, playbook_plays(*)')
        .eq('game_plan_id', params.gamePlanId)
        .order('sort_order', { ascending: true });

      if (playsError) throw playsError;

      const transformedData = (playsData || []).map((item) => ({
        id: item.id,
        game_plan_id: item.game_plan_id,
        play_code: item.play_code,
        call_number: item.call_number,
        sort_order: item.sort_order,
        notes: item.notes,
        created_at: item.created_at,
        play: Array.isArray(item.playbook_plays)
          ? item.playbook_plays[0]
          : item.playbook_plays,
      }));

      setPlays(transformedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading coach sheet...</div>
      </div>
    );
  }

  if (!gamePlan || !team) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">Game plan not found</div>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }

          .no-print {
            display: none !important;
          }

          .coach-sheet {
            width: 100%;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          thead {
            display: table-header-group;
          }
        }

        @media screen {
          .coach-sheet {
            max-width: 8.5in;
            margin: 2rem auto;
            padding: 0.5in;
            background: white;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            min-height: 11in;
          }
        }
      `}</style>

      {/* Screen Controls (not printed) */}
      <div className="no-print bg-gray-100 py-6 px-6 border-b border-gray-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{gamePlan.name}</h1>
            <p className="text-gray-600 mt-1">
              Coach Reference Sheet • {plays.length} plays
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Back
            </button>
            <button
              onClick={() => window.print()}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Print Coach Sheet
            </button>
          </div>
        </div>
      </div>

      {/* Print Instructions (not printed) */}
      <div className="no-print bg-blue-50 border-b border-blue-200 py-4 px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm text-blue-900">
            <strong>Print Instructions:</strong> Print on standard 8.5" × 11" paper. This sheet provides the full play call reference for your clipboard during the game.
          </p>
        </div>
      </div>

      {/* Coach Sheet */}
      <div className="bg-gray-100 min-h-screen py-8">
        <div className="coach-sheet">
          {/* Header */}
          <div className="border-b-2 border-gray-900 pb-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{team.name}</h1>
                <h2 className="text-xl font-semibold text-gray-700 mt-1">
                  {gamePlan.name}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  Generated: {new Date().toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">{plays.length} Plays</p>
              </div>
            </div>
          </div>

          {/* Plays Table */}
          {plays.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-600">No plays in this game plan</p>
            </div>
          ) : (
            <table className="w-full border-collapse border-2 border-gray-900">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="border border-gray-700 px-4 py-3 text-left font-bold">
                    Call #
                  </th>
                  <th className="border border-gray-700 px-4 py-3 text-left font-bold">
                    Play Code
                  </th>
                  <th className="border border-gray-700 px-4 py-3 text-left font-bold">
                    Play Name
                  </th>
                  <th className="border border-gray-700 px-4 py-3 text-left font-bold">
                    Formation
                  </th>
                  <th className="border border-gray-700 px-4 py-3 text-left font-bold">
                    Type
                  </th>
                  <th className="border border-gray-700 px-4 py-3 text-left font-bold">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {plays.map((play, index) => (
                  <tr
                    key={play.id}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="border border-gray-300 px-4 py-3 font-bold text-lg text-gray-900">
                      {play.call_number}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 font-medium text-gray-900">
                      {play.play_code}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-gray-900">
                      {play.play?.play_name || '-'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-gray-700 text-sm">
                      {play.play?.attributes?.formation || '-'}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-gray-700 text-sm">
                      {play.play?.attributes?.odk === 'offense' && (
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          OFF
                        </span>
                      )}
                      {play.play?.attributes?.odk === 'defense' && (
                        <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                          DEF
                        </span>
                      )}
                      {play.play?.attributes?.odk === 'specialTeams' && (
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                          ST
                        </span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-gray-700 text-sm">
                      {play.play?.attributes?.playType ||
                        play.play?.attributes?.coverage ||
                        play.play?.attributes?.unit ||
                        '-'}
                      {play.play?.attributes?.personnel && (
                        <div className="text-xs text-gray-500 mt-1">
                          {play.play.attributes.personnel}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-300">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <p>Generated with The Coach Hub</p>
              <p>Coach Reference Sheet - For Sideline Use</p>
            </div>
          </div>

          {/* Notes Section */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Game Notes</h3>
            <div className="border border-gray-300 rounded p-4 min-h-32">
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((line) => (
                  <div
                    key={line}
                    className="border-b border-gray-200 pb-2"
                    style={{ height: '24px' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
