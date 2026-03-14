'use client';

import React, { use, useState, useEffect } from 'react';
import { FileText, Newspaper, Loader2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReportCard } from '@/components/communication/reports/ReportCard';
import type { SharedReport, GameSummary } from '@/types/communication';

type ViewMode = 'reports' | 'summaries';

interface ReportWithView extends SharedReport {
  viewed_at: string | null;
}

export default function ParentReportsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('reports');
  const [reports, setReports] = useState<ReportWithView[]>([]);
  const [summaries, setSummaries] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [reportsRes, summariesRes] = await Promise.all([
          fetch(`/api/communication/reports?teamId=${teamId}`),
          fetch(`/api/communication/game-summaries?teamId=${teamId}`),
        ]);
        if (reportsRes.ok) {
          const d = await reportsRes.json();
          setReports(d.reports || []);
        }
        if (summariesRes.ok) {
          const d = await summariesRes.json();
          setSummaries(d.summaries || []);
        }
      } catch {
        // Silently fail — data will stay empty and the empty states render
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [teamId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  const unreadReports = reports.filter((r) => r.viewed_at === null);
  const readReports = reports.filter((r) => r.viewed_at !== null);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href={`/parent/teams/${teamId}`}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">Reports &amp; Recaps</h1>
          <p className="text-gray-600 mt-1">Reports and game summaries from your coaching staff</p>
        </div>

        {/* Tabs */}
        <div className="inline-flex p-1 bg-gray-100 rounded-lg mb-6">
          <button
            onClick={() => setViewMode('reports')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'reports' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            Player Reports{' '}
            {unreadReports.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                {unreadReports.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode('summaries')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'summaries' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            Game Recaps
          </button>
        </div>

        {viewMode === 'reports' ? (
          <>
            {reports.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Reports Yet</h3>
                <p className="text-gray-600">
                  Your coaching staff hasn&apos;t shared any reports yet.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {unreadReports.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                      New
                    </h2>
                    <div className="space-y-3">
                      {unreadReports.map((report) => {
                        const data = report.report_data as Record<string, unknown>;
                        return (
                          <ReportCard
                            key={report.id}
                            report={report}
                            playerName={
                              typeof data.playerName === 'string' ? data.playerName : undefined
                            }
                            onClick={() =>
                              router.push(`/parent/teams/${teamId}/reports/${report.id}`)
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                {readReports.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                      Previously Viewed
                    </h2>
                    <div className="space-y-3">
                      {readReports.map((report) => {
                        const data = report.report_data as Record<string, unknown>;
                        return (
                          <ReportCard
                            key={report.id}
                            report={report}
                            playerName={
                              typeof data.playerName === 'string' ? data.playerName : undefined
                            }
                            onClick={() =>
                              router.push(`/parent/teams/${teamId}/reports/${report.id}`)
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : summaries.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <Newspaper className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Game Recaps Yet</h3>
            <p className="text-gray-600">
              Game recaps will appear here after your coaching staff publishes them.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map((summary) => (
              <div
                key={summary.id}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() =>
                  router.push(`/parent/teams/${teamId}/reports/summary/${summary.id}`)
                }
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    vs {summary.opponent || 'Opponent'}
                    {summary.score_us !== null && summary.score_them !== null && (
                      <span className="ml-2 font-normal text-gray-500">
                        ({summary.score_us}-{summary.score_them})
                      </span>
                    )}
                  </h3>
                  <span className="text-sm text-gray-400">
                    {summary.game_date
                      ? new Date(summary.game_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      : ''}
                  </span>
                </div>
                {summary.published_text && (
                  <p className="text-sm text-gray-600 line-clamp-3">{summary.published_text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
