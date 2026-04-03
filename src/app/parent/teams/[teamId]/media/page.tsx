'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import { Video, FileText, Newspaper, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { VideoCard } from '@/components/communication/videos/VideoCard';
import { ReportCard } from '@/components/communication/reports/ReportCard';
import type { SharedVideo, SharedReport, GameSummary } from '@/types/communication';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivePill = 'videos' | 'reports';

type VideoWithViewStatus = SharedVideo & {
  viewed_at: string | null;
  view_count: number;
  thumbnail_url?: string | null;
};

interface ReportWithView extends SharedReport {
  viewed_at: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParentMediaPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();

  const [activePill, setActivePill] = useState<ActivePill>('videos');
  const [videos, setVideos] = useState<VideoWithViewStatus[]>([]);
  const [reports, setReports] = useState<ReportWithView[]>([]);
  const [summaries, setSummaries] = useState<GameSummary[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportsFetched, setReportsFetched] = useState(false);

  // Fetch videos on mount (default pill)
  const fetchVideos = useCallback(async () => {
    setLoadingVideos(true);
    try {
      const res = await fetch(`/api/communication/videos?teamId=${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingVideos(false);
    }
  }, [teamId]);

  // Fetch reports lazily (only when pill is switched)
  const fetchReports = useCallback(async () => {
    if (reportsFetched) return;
    setLoadingReports(true);
    try {
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
      setReportsFetched(true);
    } catch {
      // silent
    } finally {
      setLoadingReports(false);
    }
  }, [teamId, reportsFetched]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  useEffect(() => {
    if (activePill === 'reports') fetchReports();
  }, [activePill, fetchReports]);

  const unreadReports = reports.filter((r) => r.viewed_at === null);
  const readReports = reports.filter((r) => r.viewed_at !== null);
  const [reportView, setReportView] = useState<'reports' | 'summaries'>('reports');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Pill toggle */}
        <div className="inline-flex p-1 bg-gray-100 rounded-lg mb-6">
          <button
            onClick={() => setActivePill('videos')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activePill === 'videos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            Videos
          </button>
          <button
            onClick={() => setActivePill('reports')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activePill === 'reports' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            Reports
            {unreadReports.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                {unreadReports.length}
              </span>
            )}
          </button>
        </div>

        {/* ================================================================= */}
        {/* VIDEOS                                                            */}
        {/* ================================================================= */}
        {activePill === 'videos' && (
          loadingVideos ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
              <Video className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Videos Yet</h3>
              <p className="text-gray-600">
                Your coaching staff hasn&apos;t shared any videos yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  isCoachView={false}
                  onWatch={(id) => router.push(`/parent/teams/${teamId}/videos/${id}`)}
                />
              ))}
            </div>
          )
        )}

        {/* ================================================================= */}
        {/* REPORTS                                                           */}
        {/* ================================================================= */}
        {activePill === 'reports' && (
          loadingReports ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Sub-tabs: Player Reports / Game Recaps */}
              <div className="inline-flex p-1 bg-gray-100 rounded-lg mb-6">
                <button
                  onClick={() => setReportView('reports')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    reportView === 'reports' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Player Reports
                </button>
                <button
                  onClick={() => setReportView('summaries')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    reportView === 'summaries' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Game Recaps
                </button>
              </div>

              {reportView === 'reports' ? (
                reports.length === 0 ? (
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
                        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">New</h2>
                        <div className="space-y-3">
                          {unreadReports.map((report) => {
                            const data = report.report_data as Record<string, unknown>;
                            return (
                              <ReportCard
                                key={report.id}
                                report={report}
                                playerName={typeof data.playerName === 'string' ? data.playerName : undefined}
                                onClick={() => router.push(`/parent/teams/${teamId}/reports/${report.id}`)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {readReports.length > 0 && (
                      <div>
                        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Previously Viewed</h2>
                        <div className="space-y-3">
                          {readReports.map((report) => {
                            const data = report.report_data as Record<string, unknown>;
                            return (
                              <ReportCard
                                key={report.id}
                                report={report}
                                playerName={typeof data.playerName === 'string' ? data.playerName : undefined}
                                onClick={() => router.push(`/parent/teams/${teamId}/reports/${report.id}`)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
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
                      onClick={() => router.push(`/parent/teams/${teamId}/reports/summary/${summary.id}`)}
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
                            ? new Date(summary.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
            </>
          )
        )}
      </div>
    </div>
  );
}
