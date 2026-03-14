'use client';

import React, { use, useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Star, TrendingUp, Award, Users } from 'lucide-react';
import Link from 'next/link';
import type { SharedReport } from '@/types/communication';

export default function ParentReportDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; reportId: string }>;
}) {
  const { teamId, reportId } = use(params);
  const [report, setReport] = useState<SharedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        setLoading(true);
        const response = await fetch(`/api/communication/reports/${reportId}`);
        if (!response.ok) throw new Error('Report not found');
        const data = await response.json();
        setReport(data.report);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [reportId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">{error || 'Report not found'}</p>
      </div>
    );
  }

  const data = report.report_data as Record<string, unknown>;
  const highlights = Array.isArray(data.highlights) ? (data.highlights as string[]) : [];
  const growthAreas = Array.isArray(data.growthAreas) ? (data.growthAreas as string[]) : [];
  const positionsPlayed = Array.isArray(data.positionsPlayed)
    ? (data.positionsPlayed as string[])
    : [];
  const gamesPlayed = typeof data.gamesPlayed === 'number' ? data.gamesPlayed : undefined;
  const totalPlays = typeof data.totalPlays === 'number' ? data.totalPlays : undefined;
  const playerName = typeof data.playerName === 'string' ? data.playerName : undefined;
  const jerseyNumber = typeof data.jerseyNumber === 'string' || typeof data.jerseyNumber === 'number'
    ? String(data.jerseyNumber)
    : undefined;
  const position = typeof data.position === 'string' ? data.position : undefined;
  const opponent = typeof data.opponent === 'string' ? data.opponent : undefined;
  const coachNotes =
    report.coach_notes ?? (typeof data.coachNotes === 'string' ? data.coachNotes : undefined);
  const teamEffortSummary =
    typeof data.teamEffortSummary === 'string' ? data.teamEffortSummary : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/parent/teams/${teamId}/reports`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Reports
        </Link>

        {/* Header Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="text-center mb-6">
            {playerName ? (
              <>
                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-xl font-bold">#{jerseyNumber ?? '?'}</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{playerName}</h1>
                {position && <p className="text-gray-500 mt-1">{position}</p>}
              </>
            ) : opponent ? (
              <h1 className="text-2xl font-bold text-gray-900">Game Recap vs {opponent}</h1>
            ) : null}
          </div>

          {/* Stats Grid */}
          {(gamesPlayed !== undefined || totalPlays !== undefined) && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              {gamesPlayed !== undefined && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-gray-900">{gamesPlayed}</p>
                  <p className="text-sm text-gray-500 mt-1">Games Played</p>
                </div>
              )}
              {totalPlays !== undefined && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-gray-900">{totalPlays}</p>
                  <p className="text-sm text-gray-500 mt-1">Total Plays</p>
                </div>
              )}
            </div>
          )}

          {/* Positions */}
          {positionsPlayed.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                Positions
              </h3>
              <div className="flex gap-2 flex-wrap">
                {positionsPlayed.map((pos, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                  >
                    {pos}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Highlights */}
        {highlights.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-gray-900">Highlights</h2>
            </div>
            <ul className="space-y-3">
              {highlights.map((highlight, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-700">{highlight}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Growth Areas */}
        {growthAreas.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-purple-500" />
              <h2 className="font-semibold text-gray-900">Areas of Growth</h2>
            </div>
            <ul className="space-y-3">
              {growthAreas.map((area, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-700">{area}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Coach Notes */}
        {coachNotes && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">Coach&apos;s Note</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{coachNotes}</p>
          </div>
        )}

        {/* Team Effort Summary (game recaps) */}
        {teamEffortSummary && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-blue-500" />
              <h2 className="font-semibold text-gray-900">Team Effort</h2>
            </div>
            <p className="text-sm text-gray-700">{teamEffortSummary}</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          Shared on{' '}
          {new Date(report.shared_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>
    </div>
  );
}
