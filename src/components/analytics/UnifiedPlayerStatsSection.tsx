/**
 * Unified Player Stats Section
 *
 * Displays complete player profiles merging offensive, OL, and defensive stats
 * Supports multi-position players by showing ALL stat categories
 */

'use client';

import { UnifiedPlayerStats } from '@/types/football';
import CollapsibleSection from './CollapsibleSection';

interface Props {
  data: UnifiedPlayerStats[];
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function UnifiedPlayerStatsSection({ data, viewMode, level, gameName }: Props) {
  const title = level === 'game'
    ? `Player Statistics - ${gameName || 'Game'}`
    : 'Player Statistics - Season';

  if (data.length === 0) {
    return (
      <CollapsibleSection
        id="unified-player-stats"
        title={title}
        badge="Complete"
        badgeColor="blue"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">No Player Stats</h3>
          <p className="text-gray-600">
            Tag plays with player attribution in Film Room to see statistics.
          </p>
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="unified-player-stats"
      title={title}
      badge="Complete"
      badgeColor="blue"
      defaultExpanded={true}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            {data.length} player{data.length !== 1 ? 's' : ''} with stats · Showing all offensive and defensive data
          </p>
        </div>

        {viewMode === 'list' && (
          <div className="space-y-4">
            {data.map(player => (
              <PlayerStatCard key={player.playerId} player={player} />
            ))}
          </div>
        )}

        {viewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.map(player => (
              <PlayerStatCard key={player.playerId} player={player} compact />
            ))}
          </div>
        )}

        {viewMode === 'print' && (
          <div className="space-y-6">
            {data.map(player => (
              <PlayerStatCard key={player.playerId} player={player} />
            ))}
          </div>
        )}
      </div>

      <p className="text-sm text-gray-600 mt-8">
        <strong>Note:</strong> Multi-position players show stats from all positions they play.
        Offensive, OL, and defensive stats are merged into a single complete profile.
      </p>
    </CollapsibleSection>
  );
}

function PlayerStatCard({ player, compact }: { player: UnifiedPlayerStats, compact?: boolean }) {
  const hasOffense = player.offense !== null;
  const hasOL = player.offensiveLine !== null;
  const hasDefense = player.defense !== null;

  return (
    <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            #{player.jerseyNumber} {player.playerName}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {player.positions.length > 0 ? (
              <>
                Positions: <span className="font-medium">{player.positions.join(', ')}</span>
                {player.primaryPosition && <span className="text-gray-500"> (Primary: {player.primaryPosition})</span>}
              </>
            ) : (
              <span className="text-gray-500">No positions assigned</span>
            )}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold text-gray-900">{player.totalSnaps} snaps</div>
          <div className="text-gray-600">{player.totalTouchdowns} TDs</div>
        </div>
      </div>

      {/* Offensive Stats */}
      {hasOffense && player.offense && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
            <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
            Offensive Stats
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {player.offense.carries > 0 && (
              <div>
                <div className="text-gray-600 text-xs uppercase font-medium">Rushing</div>
                <div className="font-semibold text-gray-900">
                  {player.offense.carries} att · {player.offense.rushYards} yds · {player.offense.rushAvg.toFixed(1)} avg
                </div>
                <div className="text-gray-600 text-xs">
                  {player.offense.rushTouchdowns} TD · {player.offense.rushSuccessRate.toFixed(1)}% success
                </div>
              </div>
            )}
            {player.offense.passAttempts > 0 && (
              <div>
                <div className="text-gray-600 text-xs uppercase font-medium">Passing</div>
                <div className="font-semibold text-gray-900">
                  {player.offense.completions}/{player.offense.passAttempts} ({player.offense.completionPct.toFixed(1)}%)
                </div>
                <div className="text-gray-600 text-xs">
                  {player.offense.passYards} yds · {player.offense.passTouchdowns} TD · {player.offense.interceptions} INT
                </div>
              </div>
            )}
            {player.offense.targets > 0 && (
              <div>
                <div className="text-gray-600 text-xs uppercase font-medium">Receiving</div>
                <div className="font-semibold text-gray-900">
                  {player.offense.receptions}/{player.offense.targets} tgt ({player.offense.catchRate.toFixed(1)}%)
                </div>
                <div className="text-gray-600 text-xs">
                  {player.offense.recYards} yds · {player.offense.recAvg.toFixed(1)} avg · {player.offense.recTouchdowns} TD
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offensive Line Stats */}
      {hasOL && player.offensiveLine && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center">
            <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
            Offensive Line Stats
          </h4>
          <div className="text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-600 text-xs uppercase font-medium">Block Win Rate</div>
                <div className="font-semibold text-gray-900 text-lg">
                  {player.offensiveLine.blockWinRate.toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-600 text-xs">
                  {player.offensiveLine.blockWins}W-{player.offensiveLine.blockLosses}L of {player.offensiveLine.totalAssignments}
                </div>
                {player.offensiveLine.penalties > 0 && (
                  <div className="text-red-600 text-xs font-medium mt-1">
                    {player.offensiveLine.penalties} penalties
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Defensive Stats */}
      {hasDefense && player.defense && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="text-sm font-semibold text-red-900 mb-3 flex items-center">
            <span className="w-2 h-2 bg-red-600 rounded-full mr-2"></span>
            Defensive Stats
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-600 text-xs uppercase font-medium">Tackling</div>
              <div className="font-semibold text-gray-900">
                {player.defense.totalTackles} tackles ({player.defense.primaryTackles} primary, {player.defense.assistTackles} ast)
              </div>
              {player.defense.missedTackles > 0 && (
                <div className="text-gray-600 text-xs">
                  {player.defense.missedTackles} missed
                </div>
              )}
            </div>
            {(player.defense.pressures > 0 || player.defense.sacks > 0) && (
              <div>
                <div className="text-gray-600 text-xs uppercase font-medium">Pass Rush</div>
                <div className="font-semibold text-gray-900">
                  {player.defense.sacks} sacks · {player.defense.pressures} pressures
                </div>
                <div className="text-gray-600 text-xs">
                  {player.defense.pressureRate.toFixed(1)}% pressure rate
                </div>
              </div>
            )}
            {player.defense.targets > 0 && (
              <div>
                <div className="text-gray-600 text-xs uppercase font-medium">Coverage</div>
                <div className="font-semibold text-gray-900">
                  {player.defense.targets} tgt · {player.defense.coverageWins} wins ({player.defense.coverageSuccessRate.toFixed(1)}%)
                </div>
              </div>
            )}
            {(player.defense.interceptions > 0 || player.defense.pbus > 0 || player.defense.tfls > 0 || player.defense.forcedFumbles > 0) && (
              <div>
                <div className="text-gray-600 text-xs uppercase font-medium">Havoc</div>
                <div className="font-semibold text-gray-900">
                  {player.defense.interceptions} INT · {player.defense.pbus} PBU · {player.defense.tfls} TFL · {player.defense.forcedFumbles} FF
                </div>
                {player.defense.havocRate && player.defense.havocRate > 0 && (
                  <div className="text-gray-600 text-xs">
                    {player.defense.havocRate.toFixed(1)}% havoc rate
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty States */}
      {!hasOffense && !hasOL && !hasDefense && (
        <div className="text-sm text-gray-500 italic py-4 text-center">
          No stats available for this player
        </div>
      )}

      {!hasOffense && (hasOL || hasDefense) && (
        <div className="text-sm text-gray-400 italic mb-2">
          No offensive stats
        </div>
      )}

      {!hasDefense && (hasOffense || hasOL) && (
        <div className="text-sm text-gray-400 italic">
          No defensive stats
        </div>
      )}
    </div>
  );
}
