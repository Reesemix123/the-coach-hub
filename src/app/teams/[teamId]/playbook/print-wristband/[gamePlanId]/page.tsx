'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import type { GamePlan, GamePlanPlayWithDetails } from '@/types/football';

export default function PrintWristbandPage({
  params,
}: {
  params: { teamId: string; gamePlanId: string };
}) {
  const [gamePlan, setGamePlan] = useState<GamePlan | null>(null);
  const [plays, setPlays] = useState<GamePlanPlayWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [params.gamePlanId]);

  async function fetchData() {
    try {
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
        <div className="text-gray-400">Loading wristband...</div>
      </div>
    );
  }

  if (!gamePlan) {
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

  // Split plays into chunks based on wristband format
  const getGridDimensions = (format: string) => {
    switch (format) {
      case '3x5':
        return { cols: 3, rows: 5, perPage: 15 };
      case '4x6':
        return { cols: 4, rows: 6, perPage: 24 };
      case '2col':
        return { cols: 2, rows: 10, perPage: 20 };
      default:
        return { cols: 3, rows: 5, perPage: 15 };
    }
  };

  const { cols, rows, perPage } = getGridDimensions(gamePlan.wristband_format);
  const pages: GamePlanPlayWithDetails[][] = [];

  for (let i = 0; i < plays.length; i += perPage) {
    pages.push(plays.slice(i, i + perPage));
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: 4in 3in;
            margin: 0.25in;
          }

          .no-print {
            display: none !important;
          }

          .wristband-page {
            page-break-after: always;
            width: 100%;
            height: 100%;
          }

          .wristband-page:last-child {
            page-break-after: auto;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }

        @media screen {
          .wristband-page {
            width: 4in;
            min-height: 3in;
            margin: 1rem auto;
            padding: 0.25in;
            background: white;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
          }
        }
      `}</style>

      {/* Screen Controls (not printed) */}
      <div className="no-print bg-gray-100 py-6 px-6 border-b border-gray-300">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{gamePlan.name}</h1>
            <p className="text-gray-600 mt-1">
              QB Wristband Card • {plays.length} plays • {pages.length} page
              {pages.length !== 1 ? 's' : ''}
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
              Print Wristband
            </button>
          </div>
        </div>
      </div>

      {/* Print Instructions (not printed) */}
      <div className="no-print bg-blue-50 border-b border-blue-200 py-4 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-blue-900">
            <strong>Print Instructions:</strong> Print on cardstock for durability. Cut
            along the edges and insert into QB wristband sleeve. Each page represents one
            side of the wristband.
          </p>
        </div>
      </div>

      {/* Wristband Pages */}
      <div className="bg-gray-100 min-h-screen py-8">
        {pages.map((pagePlays, pageIndex) => (
          <div key={pageIndex} className="wristband-page">
            {/* Page Header */}
            <div className="text-center mb-3">
              <h2 className="text-lg font-bold text-gray-900">{gamePlan.name}</h2>
              <p className="text-xs text-gray-600">
                Page {pageIndex + 1} of {pages.length}
              </p>
            </div>

            {/* Play Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: '4px',
                border: '2px solid black',
              }}
            >
              {Array.from({ length: perPage }).map((_, index) => {
                const play = pagePlays[index];
                return (
                  <div
                    key={index}
                    style={{
                      border: '1px solid black',
                      padding: '4px',
                      minHeight: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: play ? 'white' : '#f9fafb',
                    }}
                  >
                    {play ? (
                      <div className="text-center">
                        <div className="font-bold text-base text-gray-900">
                          {play.call_number}
                        </div>
                        <div className="text-xs text-gray-700 mt-0.5 leading-tight">
                          {play.play?.play_name || play.play_code}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400 text-xs">-</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Page Footer */}
            <div className="text-center mt-3">
              <p className="text-xs text-gray-500">
                Generated with Titan First Read
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Empty Pages Notice (not printed) */}
      {pages.length === 0 && (
        <div className="no-print text-center py-20">
          <p className="text-gray-600">No plays in this game plan</p>
        </div>
      )}
    </>
  );
}
