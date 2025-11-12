/**
 * Player Stats Table
 *
 * Comprehensive table showing all player stats in sortable columns
 * Groups stats into Offensive, Defensive, and Special Teams categories
 */

'use client';

import { useState } from 'react';
import { UnifiedPlayerStats } from '@/types/football';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

interface Props {
  data: UnifiedPlayerStats[];
  level: 'season' | 'game';
  gameName?: string;
}

type SortColumn =
  | 'jerseyNumber' | 'playerName' | 'positions' | 'totalSnaps' | 'totalTouchdowns'
  // Offensive
  | 'carries' | 'rushYards' | 'rushAvg' | 'rushTD' | 'rushSuccess'
  | 'passAttempts' | 'completions' | 'compPct' | 'passYards' | 'passTD' | 'interceptions'
  | 'targets' | 'receptions' | 'recYards' | 'recAvg' | 'recTD' | 'catchRate'
  | 'blockWinRate' | 'blockWins' | 'blockLosses' | 'olPenalties'
  // Defensive
  | 'defensiveSnaps' | 'totalTackles' | 'primaryTackles' | 'assistTackles' | 'missedTackles'
  | 'tfls' | 'sacks' | 'pressures' | 'pressureRate'
  | 'targets_def' | 'coverageWins' | 'coverageSuccess'
  | 'interceptions_def' | 'pbus' | 'forcedFumbles' | 'havocRate';

type SortDirection = 'asc' | 'desc';

export default function PlayerStatsTable({ data, level, gameName }: Props) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('jerseyNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedGroups, setExpandedGroups] = useState({
    offensive: true,
    defensive: true,
    specialTeams: true
  });

  const toggleGroup = (group: keyof typeof expandedGroups) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      // Player info columns
      if (sortColumn === 'jerseyNumber') {
        aVal = parseInt(a.jerseyNumber) || 0;
        bVal = parseInt(b.jerseyNumber) || 0;
      } else if (sortColumn === 'playerName') {
        aVal = a.playerName.toLowerCase();
        bVal = b.playerName.toLowerCase();
      } else if (sortColumn === 'positions') {
        aVal = a.positions.join(',');
        bVal = b.positions.join(',');
      } else if (sortColumn === 'totalSnaps') {
        aVal = a.totalSnaps || 0;
        bVal = b.totalSnaps || 0;
      } else if (sortColumn === 'totalTouchdowns') {
        aVal = a.totalTouchdowns || 0;
        bVal = b.totalTouchdowns || 0;
      }
      // Offensive stats
      else if (sortColumn === 'carries') {
        aVal = a.offense?.carries || 0;
        bVal = b.offense?.carries || 0;
      } else if (sortColumn === 'rushYards') {
        aVal = a.offense?.rushYards || 0;
        bVal = b.offense?.rushYards || 0;
      } else if (sortColumn === 'rushAvg') {
        aVal = a.offense?.rushAvg || 0;
        bVal = b.offense?.rushAvg || 0;
      } else if (sortColumn === 'rushTD') {
        aVal = a.offense?.rushTouchdowns || 0;
        bVal = b.offense?.rushTouchdowns || 0;
      } else if (sortColumn === 'rushSuccess') {
        aVal = a.offense?.rushSuccessRate || 0;
        bVal = b.offense?.rushSuccessRate || 0;
      } else if (sortColumn === 'passAttempts') {
        aVal = a.offense?.passAttempts || 0;
        bVal = b.offense?.passAttempts || 0;
      } else if (sortColumn === 'completions') {
        aVal = a.offense?.completions || 0;
        bVal = b.offense?.completions || 0;
      } else if (sortColumn === 'compPct') {
        aVal = a.offense?.completionPct || 0;
        bVal = b.offense?.completionPct || 0;
      } else if (sortColumn === 'passYards') {
        aVal = a.offense?.passYards || 0;
        bVal = b.offense?.passYards || 0;
      } else if (sortColumn === 'passTD') {
        aVal = a.offense?.passTouchdowns || 0;
        bVal = b.offense?.passTouchdowns || 0;
      } else if (sortColumn === 'interceptions') {
        aVal = a.offense?.interceptions || 0;
        bVal = b.offense?.interceptions || 0;
      } else if (sortColumn === 'targets') {
        aVal = a.offense?.targets || 0;
        bVal = b.offense?.targets || 0;
      } else if (sortColumn === 'receptions') {
        aVal = a.offense?.receptions || 0;
        bVal = b.offense?.receptions || 0;
      } else if (sortColumn === 'recYards') {
        aVal = a.offense?.recYards || 0;
        bVal = b.offense?.recYards || 0;
      } else if (sortColumn === 'recAvg') {
        aVal = a.offense?.recAvg || 0;
        bVal = b.offense?.recAvg || 0;
      } else if (sortColumn === 'recTD') {
        aVal = a.offense?.recTouchdowns || 0;
        bVal = b.offense?.recTouchdowns || 0;
      } else if (sortColumn === 'catchRate') {
        aVal = a.offense?.catchRate || 0;
        bVal = b.offense?.catchRate || 0;
      } else if (sortColumn === 'blockWinRate') {
        aVal = a.offensiveLine?.blockWinRate || 0;
        bVal = b.offensiveLine?.blockWinRate || 0;
      } else if (sortColumn === 'blockWins') {
        aVal = a.offensiveLine?.blockWins || 0;
        bVal = b.offensiveLine?.blockWins || 0;
      } else if (sortColumn === 'blockLosses') {
        aVal = a.offensiveLine?.blockLosses || 0;
        bVal = b.offensiveLine?.blockLosses || 0;
      } else if (sortColumn === 'olPenalties') {
        aVal = a.offensiveLine?.penalties || 0;
        bVal = b.offensiveLine?.penalties || 0;
      }
      // Defensive stats
      else if (sortColumn === 'defensiveSnaps') {
        aVal = a.defense?.defensiveSnaps || 0;
        bVal = b.defense?.defensiveSnaps || 0;
      } else if (sortColumn === 'totalTackles') {
        aVal = a.defense?.totalTackles || 0;
        bVal = b.defense?.totalTackles || 0;
      } else if (sortColumn === 'primaryTackles') {
        aVal = a.defense?.primaryTackles || 0;
        bVal = b.defense?.primaryTackles || 0;
      } else if (sortColumn === 'assistTackles') {
        aVal = a.defense?.assistTackles || 0;
        bVal = b.defense?.assistTackles || 0;
      } else if (sortColumn === 'missedTackles') {
        aVal = a.defense?.missedTackles || 0;
        bVal = b.defense?.missedTackles || 0;
      } else if (sortColumn === 'tfls') {
        aVal = a.defense?.tfls || 0;
        bVal = b.defense?.tfls || 0;
      } else if (sortColumn === 'sacks') {
        aVal = a.defense?.sacks || 0;
        bVal = b.defense?.sacks || 0;
      } else if (sortColumn === 'pressures') {
        aVal = a.defense?.pressures || 0;
        bVal = b.defense?.pressures || 0;
      } else if (sortColumn === 'pressureRate') {
        aVal = a.defense?.pressureRate || 0;
        bVal = b.defense?.pressureRate || 0;
      } else if (sortColumn === 'targets_def') {
        aVal = a.defense?.targets || 0;
        bVal = b.defense?.targets || 0;
      } else if (sortColumn === 'coverageWins') {
        aVal = a.defense?.coverageWins || 0;
        bVal = b.defense?.coverageWins || 0;
      } else if (sortColumn === 'coverageSuccess') {
        aVal = a.defense?.coverageSuccessRate || 0;
        bVal = b.defense?.coverageSuccessRate || 0;
      } else if (sortColumn === 'interceptions_def') {
        aVal = a.defense?.interceptions || 0;
        bVal = b.defense?.interceptions || 0;
      } else if (sortColumn === 'pbus') {
        aVal = a.defense?.pbus || 0;
        bVal = b.defense?.pbus || 0;
      } else if (sortColumn === 'forcedFumbles') {
        aVal = a.defense?.forcedFumbles || 0;
        bVal = b.defense?.forcedFumbles || 0;
      } else if (sortColumn === 'havocRate') {
        aVal = a.defense?.havocRate || 0;
        bVal = b.defense?.havocRate || 0;
      }

      // String comparison
      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Numeric comparison
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  };

  const sortedData = getSortedData();

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="w-3 h-3 text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3 text-gray-900" />
      : <ChevronDown className="w-3 h-3 text-gray-900" />;
  };

  const ColumnHeader = ({ column, label, align = 'left' }: {
    column: SortColumn;
    label: string;
    align?: 'left' | 'center' | 'right';
  }) => (
    <th
      onClick={() => handleSort(column)}
      className={`px-3 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-white border-b border-gray-200 ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {label}
        <SortIcon column={column} />
      </div>
    </th>
  );

  const GroupHeader = ({
    group,
    label,
    colSpan
  }: {
    group: keyof typeof expandedGroups;
    label: string;
    colSpan: number;
  }) => {
    const isExpanded = expandedGroups[group];
    return (
      <th
        onClick={() => toggleGroup(group)}
        colSpan={isExpanded ? colSpan : 1}
        className="px-3 py-2 text-sm font-bold text-gray-900 bg-gray-100 border-b border-r-2 border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors sticky top-0"
      >
        <div className="flex items-center justify-center gap-2">
          {label}
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </th>
    );
  };

  const title = level === 'game'
    ? `Player Statistics - ${gameName || 'Game'}`
    : 'Player Statistics - Season';

  if (data.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-12 text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">No Player Stats</h3>
        <p className="text-gray-600">
          Tag plays with player attribution in Film Room to see statistics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600">
          {sortedData.length} player{sortedData.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            {/* Group headers */}
            <thead>
              <tr>
                <th colSpan={5} className="px-3 py-2 text-sm font-bold text-gray-900 bg-gray-50 border-b border-r-2 border-gray-300 sticky top-0">
                  Player Info
                </th>
                <GroupHeader group="offensive" label="Offensive Stats" colSpan={21} />
                <GroupHeader group="defensive" label="Defensive Stats" colSpan={16} />
                <GroupHeader group="specialTeams" label="Special Teams" colSpan={1} />
              </tr>

              {/* Column headers */}
              <tr>
                {/* Player Info */}
                <ColumnHeader column="jerseyNumber" label="#" align="center" />
                <ColumnHeader column="playerName" label="Name" />
                <ColumnHeader column="positions" label="Positions" />
                <ColumnHeader column="totalSnaps" label="Snaps" align="right" />
                <ColumnHeader column="totalTouchdowns" label="TDs" align="right" />

                {/* Offensive Stats */}
                {expandedGroups.offensive ? (
                  <>
                    {/* Rushing */}
                    <ColumnHeader column="carries" label="Car" align="right" />
                    <ColumnHeader column="rushYards" label="Rush Yds" align="right" />
                    <ColumnHeader column="rushAvg" label="Y/C" align="right" />
                    <ColumnHeader column="rushTD" label="Rush TD" align="right" />
                    <ColumnHeader column="rushSuccess" label="Rush Suc%" align="right" />
                    {/* Passing */}
                    <ColumnHeader column="passAttempts" label="Pass Att" align="right" />
                    <ColumnHeader column="completions" label="Comp" align="right" />
                    <ColumnHeader column="compPct" label="Comp%" align="right" />
                    <ColumnHeader column="passYards" label="Pass Yds" align="right" />
                    <ColumnHeader column="passTD" label="Pass TD" align="right" />
                    <ColumnHeader column="interceptions" label="INT" align="right" />
                    {/* Receiving */}
                    <ColumnHeader column="targets" label="Tgts" align="right" />
                    <ColumnHeader column="receptions" label="Rec" align="right" />
                    <ColumnHeader column="recYards" label="Rec Yds" align="right" />
                    <ColumnHeader column="recAvg" label="Y/R" align="right" />
                    <ColumnHeader column="recTD" label="Rec TD" align="right" />
                    <ColumnHeader column="catchRate" label="Catch%" align="right" />
                    {/* OL */}
                    <ColumnHeader column="blockWinRate" label="Block Win%" align="right" />
                    <ColumnHeader column="blockWins" label="Block W" align="right" />
                    <ColumnHeader column="blockLosses" label="Block L" align="right" />
                    <ColumnHeader column="olPenalties" label="OL Pen" align="right" />
                  </>
                ) : (
                  <th className="px-3 py-3 text-xs text-gray-500 bg-white border-b border-gray-200">
                    <span className="text-gray-400 italic">Collapsed</span>
                  </th>
                )}

                {/* Defensive Stats */}
                {expandedGroups.defensive ? (
                  <>
                    <ColumnHeader column="defensiveSnaps" label="Def Snaps" align="right" />
                    <ColumnHeader column="totalTackles" label="Tackles" align="right" />
                    <ColumnHeader column="primaryTackles" label="Solo" align="right" />
                    <ColumnHeader column="assistTackles" label="Ast" align="right" />
                    <ColumnHeader column="missedTackles" label="Miss" align="right" />
                    <ColumnHeader column="tfls" label="TFL" align="right" />
                    <ColumnHeader column="sacks" label="Sacks" align="right" />
                    <ColumnHeader column="pressures" label="Press" align="right" />
                    <ColumnHeader column="pressureRate" label="Press%" align="right" />
                    <ColumnHeader column="targets_def" label="Tgts" align="right" />
                    <ColumnHeader column="coverageWins" label="Cov W" align="right" />
                    <ColumnHeader column="coverageSuccess" label="Cov%" align="right" />
                    <ColumnHeader column="interceptions_def" label="INT" align="right" />
                    <ColumnHeader column="pbus" label="PBU" align="right" />
                    <ColumnHeader column="forcedFumbles" label="FF" align="right" />
                    <ColumnHeader column="havocRate" label="Havoc%" align="right" />
                  </>
                ) : (
                  <th className="px-3 py-3 text-xs text-gray-500 bg-white border-b border-gray-200">
                    <span className="text-gray-400 italic">Collapsed</span>
                  </th>
                )}

                {/* Special Teams (placeholder) */}
                {expandedGroups.specialTeams ? (
                  <th className="px-3 py-3 text-xs text-gray-500 bg-white border-b border-gray-200">
                    <span className="text-gray-400 italic">Coming soon</span>
                  </th>
                ) : (
                  <th className="px-3 py-3 text-xs text-gray-500 bg-white border-b border-gray-200">
                    <span className="text-gray-400 italic">Collapsed</span>
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.map((player) => (
                <tr key={player.playerId} className="hover:bg-gray-50 transition-colors">
                  {/* Player Info */}
                  <td className="px-3 py-4 text-sm text-center font-medium text-gray-900">
                    #{player.jerseyNumber}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900 font-medium">
                    {player.playerName}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-600">
                    {player.positions.join(', ') || '-'}
                  </td>
                  <td className="px-3 py-4 text-sm text-right text-gray-900">
                    {player.totalSnaps}
                  </td>
                  <td className="px-3 py-4 text-sm text-right text-gray-900">
                    {player.totalTouchdowns}
                  </td>

                  {/* Offensive Stats */}
                  {expandedGroups.offensive ? (
                    <>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.carries || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.rushYards || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.rushAvg ? player.offense.rushAvg.toFixed(1) : '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.rushTouchdowns || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.rushSuccessRate ? player.offense.rushSuccessRate.toFixed(1) + '%' : '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.passAttempts || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.completions || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.completionPct ? player.offense.completionPct.toFixed(1) + '%' : '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.passYards || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.passTouchdowns || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.interceptions || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.targets || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.receptions || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.recYards || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.recAvg ? player.offense.recAvg.toFixed(1) : '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.recTouchdowns || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offense?.catchRate ? player.offense.catchRate.toFixed(1) + '%' : '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offensiveLine?.blockWinRate ? player.offensiveLine.blockWinRate.toFixed(1) + '%' : '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offensiveLine?.blockWins || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offensiveLine?.blockLosses || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.offensiveLine?.penalties || '-'}</td>
                    </>
                  ) : (
                    <td className="px-3 py-4 text-sm text-gray-400 italic">-</td>
                  )}

                  {/* Defensive Stats */}
                  {expandedGroups.defensive ? (
                    <>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.defensiveSnaps || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.totalTackles || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.primaryTackles || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.assistTackles || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.missedTackles || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.tfls || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.sacks || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.pressures || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.pressureRate ? player.defense.pressureRate.toFixed(1) + '%' : '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.targets || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.coverageWins || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.coverageSuccessRate ? player.defense.coverageSuccessRate.toFixed(1) + '%' : '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.interceptions || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.pbus || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.forcedFumbles || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900">{player.defense?.havocRate ? player.defense.havocRate.toFixed(1) + '%' : '-'}</td>
                    </>
                  ) : (
                    <td className="px-3 py-4 text-sm text-gray-400 italic">-</td>
                  )}

                  {/* Special Teams */}
                  <td className="px-3 py-4 text-sm text-gray-400 italic">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        <strong>Tip:</strong> Click column headers to sort. Click group headers to collapse/expand stat categories.
      </p>
    </div>
  );
}
