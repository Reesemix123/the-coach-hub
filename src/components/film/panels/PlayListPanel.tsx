'use client';

import React, { useState, memo, type RefObject } from 'react';
import { SPECIAL_TEAMS_UNITS, RESULT_TYPES } from '@/types/football';
import type { Drive } from '@/types/football';

// ============================================
// TYPES
// ============================================

interface PlayInstance {
  id: string;
  video_id: string;
  camera_id?: string;
  play_code: string;
  timestamp_start: number;
  timestamp_end?: number;
  down?: number;
  distance?: number;
  result?: string;
  result_type?: string;
  yards_gained?: number;
  notes?: string;
  play_name?: string;
  is_opponent_play?: boolean;
  special_teams_unit?: string;
  drive_id?: string;
  quarter?: number;
}

interface PlayListPanelProps {
  playInstances: PlayInstance[];
  drives: Drive[];
  formatTime: (seconds: number) => string;
  getDownLabel: (value: string) => string;
  onEditInstance: (instance: PlayInstance) => void;
  onDeleteInstance: (instanceId: string) => void;
  onJumpToPlay: (timestamp: number, endTimestamp?: number, sourceCameraId?: string) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}

// ============================================
// COMPONENT
// ============================================

export const PlayListPanel = memo(function PlayListPanel({
  playInstances,
  drives,
  formatTime,
  getDownLabel,
  onEditInstance,
  onDeleteInstance,
  onJumpToPlay,
  videoRef,
}: PlayListPanelProps) {
  const [filterQuarter, setFilterQuarter] = useState<string>('all');
  const [filterOffenseDefense, setFilterOffenseDefense] = useState<string>('all');
  const [filterDrive, setFilterDrive] = useState<string>('all');

  function filterPlays(instances: PlayInstance[]) {
    return instances.filter(instance => {
      if (filterQuarter !== 'all' && String(instance.quarter) !== filterQuarter) return false;
      if (filterOffenseDefense === 'offense' && (instance.is_opponent_play || instance.special_teams_unit)) return false;
      if (filterOffenseDefense === 'defense' && (!instance.is_opponent_play || instance.special_teams_unit)) return false;
      if (filterOffenseDefense === 'specialTeams' && !instance.special_teams_unit) return false;
      if (filterDrive !== 'all' && instance.drive_id !== filterDrive) return false;
      return true;
    });
  }

  const filteredPlays = filterPlays(playInstances);
  const hasActiveFilters = filterQuarter !== 'all' || filterOffenseDefense !== 'all' || filterDrive !== 'all';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Filters */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Quarter Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Quarter</label>
            <select
              value={filterQuarter}
              onChange={(e) => setFilterQuarter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            >
              <option value="all">All Quarters</option>
              <option value="1">1st Quarter</option>
              <option value="2">2nd Quarter</option>
              <option value="3">3rd Quarter</option>
              <option value="4">4th Quarter</option>
              <option value="OT">Overtime</option>
            </select>
          </div>

          {/* Offense/Defense/Special Teams Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Play Type</label>
            <select
              value={filterOffenseDefense}
              onChange={(e) => setFilterOffenseDefense(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            >
              <option value="all">All Plays</option>
              <option value="offense">Our Offense</option>
              <option value="defense">Our Defense (Opponent Plays)</option>
              <option value="specialTeams">Special Teams</option>
            </select>
          </div>

          {/* Drive Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Drive</label>
            <select
              value={filterDrive}
              onChange={(e) => setFilterDrive(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900"
            >
              <option value="all">All Drives</option>
              {drives.map((drive) => (
                <option key={drive.id} value={drive.id}>
                  Drive #{drive.drive_number} - Q{drive.quarter} - {drive.possession_type === 'offense' ? '🟢 OFF' : '🔴 DEF'} ({drive.result})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="mt-3">
            <button
              onClick={() => {
                setFilterQuarter('all');
                setFilterOffenseDefense('all');
                setFilterDrive('all');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Tagged Plays ({filteredPlays.length})
      </h3>

      {filteredPlays.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p className="text-gray-600 text-sm">
            {playInstances.length === 0 ? (
              <>
                No plays tagged yet.<br/>
                Use &quot;Mark Start/End&quot; to tag plays.
              </>
            ) : (
              'No plays match the selected filters.'
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="max-h-[600px] overflow-y-auto pr-2 space-y-3">
            {filteredPlays.map((instance, index) => (
              <div
                key={instance.id}
                className="border rounded-lg p-3 hover:shadow-sm transition-shadow bg-gray-50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                      <span className="font-semibold text-gray-900">{instance.play_code}</span>
                      {instance.special_teams_unit && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                          {SPECIAL_TEAMS_UNITS.find(u => u.value === instance.special_teams_unit)?.label || 'Special Teams'}
                        </span>
                      )}
                      {instance.is_opponent_play && !instance.special_teams_unit && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                          Opponent
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{instance.play_name}</p>
                  </div>

                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      onClick={() => onEditInstance(instance)}
                      className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteInstance(instance.id)}
                      className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="text-xs space-y-1 text-gray-700 mb-2">
                  <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-200">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">
                      {formatTime(instance.timestamp_start)}
                      {instance.timestamp_end && ` - ${formatTime(instance.timestamp_end)}`}
                      {instance.timestamp_end && (
                        <span className="text-gray-500 ml-1">
                          ({Math.round(instance.timestamp_end - instance.timestamp_start)}s)
                        </span>
                      )}
                    </span>
                  </div>

                  {instance.down && instance.distance && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Situation:</span>
                      <span className="font-medium">
                        {getDownLabel(String(instance.down))} & {instance.distance}
                      </span>
                    </div>
                  )}

                  {(instance.result || instance.result_type) && (
                    <div className="bg-white rounded px-2 py-1 border border-gray-200">
                      <span className="text-gray-600">Result:</span>
                      <span className="text-gray-900 font-medium ml-1">
                        {RESULT_TYPES.find(r => r.value === (instance.result || instance.result_type))?.label || (instance.result || instance.result_type)}
                      </span>
                    </div>
                  )}

                  {instance.yards_gained !== null && instance.yards_gained !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Yards:</span>
                      <span className={`font-medium ${instance.yards_gained >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {instance.yards_gained > 0 ? '+' : ''}{instance.yards_gained}
                      </span>
                    </div>
                  )}

                  {instance.notes && (
                    <div className="text-gray-700 mt-1 text-xs bg-yellow-50 p-2 rounded border border-yellow-200">
                      {instance.notes}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onJumpToPlay(instance.timestamp_start, instance.timestamp_end || undefined, instance.camera_id || instance.video_id)}
                  className="w-full relative overflow-hidden rounded hover:opacity-90 transition-opacity group bg-gray-900"
                >
                  <div className="w-full h-24 flex items-center justify-center">
                    <div className="bg-white bg-opacity-90 rounded-full p-2 group-hover:bg-opacity-100 transition-all">
                      <svg className="w-6 h-6 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resume from here button */}
      {playInstances.length > 0 && (
        <button
          onClick={() => {
            const sortedPlays = [...playInstances].sort((a, b) =>
              (b.timestamp_end || b.timestamp_start) - (a.timestamp_end || a.timestamp_start)
            );
            const lastPlay = sortedPlays[0];
            if (lastPlay && videoRef.current) {
              const lastPlayEndTime = lastPlay.timestamp_end || lastPlay.timestamp_start;
              videoRef.current.currentTime = lastPlayEndTime;
              videoRef.current.pause();
            }
          }}
          className="w-full mt-4 px-4 py-3 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Resume Tagging
        </button>
      )}
    </div>
  );
});
