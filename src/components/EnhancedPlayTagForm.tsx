// src/components/EnhancedPlayTagForm.tsx
// Tier-based play tagging form with progressive disclosure
// Shows fields based on team's analytics tier

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { AdvancedAnalyticsService } from '@/lib/services/advanced-analytics.service';
import type { TeamAnalyticsConfig, PlayerRecord } from '@/types/football';
import { playerHasPosition } from '@/utils/playerHelpers';

interface EnhancedPlayTagFormProps {
  teamId: string;
  onFieldsChange?: (fields: any) => void;
  existingData?: any;
}

export default function EnhancedPlayTagForm({ teamId, onFieldsChange, existingData }: EnhancedPlayTagFormProps) {
  const [config, setConfig] = useState<TeamAnalyticsConfig | null>(null);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const analyticsService = new AdvancedAnalyticsService();

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const fetchData = async () => {
    try {
      // Get team's analytics tier
      const tierConfig = await analyticsService.getTeamTier(teamId);
      setConfig(tierConfig);

      // Get players for attribution
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('jersey_number');

      setPlayers(playersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    if (onFieldsChange) {
      onFieldsChange({ [field]: value });
    }
  };

  if (loading || !config) {
    return (
      <div className="text-sm text-gray-500">Loading tier settings...</div>
    );
  }

  const showPlayerAttribution = config.enable_player_attribution;
  const showOLTracking = config.enable_ol_tracking;
  const showDefensiveTracking = config.enable_defensive_tracking;
  const showSituational = config.enable_situational_splits;

  const olPlayers = players.filter(p => playerHasPosition(p, ['LT', 'LG', 'C', 'RG', 'RT']));
  const qbs = players.filter(p => playerHasPosition(p, 'QB'));
  const ballCarriers = players.filter(p => playerHasPosition(p, ['QB', 'RB', 'FB', 'WR']));
  const receivers = players.filter(p => playerHasPosition(p, ['WR', 'TE', 'RB']));

  return (
    <div className="space-y-6">
      {/* Tier Badge */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="text-xs text-gray-500">Analytics Tier</div>
        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
          {config.tier.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {/* Player Attribution (Tier 2+) */}
      {showPlayerAttribution && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-900">Player Attribution</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                QB
              </label>
              <select
                name="qb_id"
                defaultValue={existingData?.qb_id || ''}
                onChange={(e) => handleFieldChange('qb_id', e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select QB...</option>
                {qbs.map(p => (
                  <option key={p.id} value={p.id}>
                    #{p.jersey_number} {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Ball Carrier
              </label>
              <select
                name="ball_carrier_id"
                defaultValue={existingData?.ball_carrier_id || ''}
                onChange={(e) => handleFieldChange('ball_carrier_id', e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select player...</option>
                {ballCarriers.map(p => (
                  <option key={p.id} value={p.id}>
                    #{p.jersey_number} {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Target (Pass)
              </label>
              <select
                name="target_id"
                defaultValue={existingData?.target_id || ''}
                onChange={(e) => handleFieldChange('target_id', e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select target...</option>
                {receivers.map(p => (
                  <option key={p.id} value={p.id}>
                    #{p.jersey_number} {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Offensive Line Tracking (Tier 3) */}
      {showOLTracking && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-900">Offensive Line Performance</h4>

          <div className="grid grid-cols-5 gap-3">
            {['LT', 'LG', 'C', 'RG', 'RT'].map((pos) => {
              const posPlayers = olPlayers.filter(p => playerHasPosition(p, pos));

              return (
                <div key={pos} className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">
                    {pos}
                  </label>
                  <select
                    name={`${pos.toLowerCase()}_id`}
                    defaultValue={existingData?.[`${pos.toLowerCase()}_id`] || ''}
                    onChange={(e) => handleFieldChange(`${pos.toLowerCase()}_id`, e.target.value || null)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">-</option>
                    {posPlayers.map(p => (
                      <option key={p.id} value={p.id}>
                        #{p.jersey_number}
                      </option>
                    ))}
                  </select>
                  <select
                    name={`${pos.toLowerCase()}_block_result`}
                    defaultValue={existingData?.[`${pos.toLowerCase()}_block_result`] || ''}
                    onChange={(e) => handleFieldChange(`${pos.toLowerCase()}_block_result`, e.target.value || null)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">-</option>
                    <option value="win">Win</option>
                    <option value="loss">Loss</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <strong>Win:</strong> Maintained block, no pressure.
            <strong className="ml-3">Loss:</strong> Beat, pressure allowed.
            <strong className="ml-3">Neutral:</strong> Chip/help block.
          </div>
        </div>
      )}

      {/* Situational Data (Tier 3) */}
      {showSituational && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-900">Situational</h4>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="has_motion"
                  defaultChecked={existingData?.has_motion || false}
                  onChange={(e) => handleFieldChange('has_motion', e.target.checked)}
                  className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                />
                <span className="text-sm text-gray-700">Motion</span>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_play_action"
                  defaultChecked={existingData?.is_play_action || false}
                  onChange={(e) => handleFieldChange('is_play_action', e.target.checked)}
                  className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                />
                <span className="text-sm text-gray-700">Play Action</span>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="facing_blitz"
                  defaultChecked={existingData?.facing_blitz || false}
                  onChange={(e) => handleFieldChange('facing_blitz', e.target.checked)}
                  className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                />
                <span className="text-sm text-gray-700">vs Blitz</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Box Count
              </label>
              <input
                type="number"
                name="box_count"
                min="4"
                max="9"
                defaultValue={existingData?.box_count || ''}
                onChange={(e) => handleFieldChange('box_count', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="5-8"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Target Depth
              </label>
              <select
                name="target_depth"
                defaultValue={existingData?.target_depth || ''}
                onChange={(e) => handleFieldChange('target_depth', e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select...</option>
                <option value="behind_los">Behind LOS</option>
                <option value="short">Short (0-10 yds)</option>
                <option value="intermediate">Intermediate (10-20 yds)</option>
                <option value="deep">Deep (20+ yds)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Pass Location
              </label>
              <select
                name="pass_location"
                defaultValue={existingData?.pass_location || ''}
                onChange={(e) => handleFieldChange('pass_location', e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select...</option>
                <option value="left">Left</option>
                <option value="middle">Middle</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Play Concept (optional)
            </label>
            <input
              type="text"
              name="play_concept"
              defaultValue={existingData?.play_concept || ''}
              onChange={(e) => handleFieldChange('play_concept', e.target.value || null)}
              placeholder="e.g., Inside Zone, Four Verticals, Mesh"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>
      )}

      {/* Upgrade Prompt */}
      {(!showPlayerAttribution || !showSituational) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
          <div className="font-medium text-gray-900 mb-2">Want more analytics?</div>
          <div className="text-gray-600 mb-3">
            Upgrade your tier in team settings to unlock:
          </div>
          <ul className="space-y-1 text-gray-600 ml-4 list-disc">
            {!showPlayerAttribution && <li>Player attribution (QB, ball carrier, targets)</li>}
            {!showOLTracking && <li>Offensive line block win rates</li>}
            {!showDefensiveTracking && <li>Defensive player tracking</li>}
            {!showSituational && <li>Situational splits (motion, PA, blitz)</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
