'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Upload, AlertTriangle, ArrowRight, Users, Target } from 'lucide-react';

interface TokenBalanceSummary {
  subscriptionAvailable: number;
  purchasedAvailable: number;
  totalAvailable: number;
  usedThisPeriod: number;
  monthlyAllocation: number;
  rolloverCap: number;
  periodStart: string | null;
  periodEnd: string | null;
  hasActiveSubscription: boolean;
  // Designated token fields
  teamAvailable: number;
  teamUsedThisPeriod: number;
  opponentAvailable: number;
  opponentUsedThisPeriod: number;
  monthlyTeamAllocation: number;
  monthlyOpponentAllocation: number;
}

interface TokenBalanceCardProps {
  teamId: string;
  variant?: 'compact' | 'full';
  className?: string;
  onBalanceLoad?: (balance: TokenBalanceSummary) => void;
}

export default function TokenBalanceCard({
  teamId,
  variant = 'compact',
  className = '',
  onBalanceLoad
}: TokenBalanceCardProps) {
  const [balance, setBalance] = useState<TokenBalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tokens?team_id=${teamId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch token balance');
        }

        const data = await response.json();
        setBalance(data.balance);
        onBalanceLoad?.(data.balance);
      } catch (err) {
        console.error('Error fetching token balance:', err);
        setError('Unable to load token balance');
      } finally {
        setLoading(false);
      }
    };

    if (teamId) {
      fetchBalance();
    }
  }, [teamId, onBalanceLoad]);

  // Format period end date
  const formatPeriodEnd = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get breakdown using actual designated token values
  const getBreakdown = (): string => {
    if (!balance) return '';
    const team = balance.teamAvailable ?? 0;
    const opponent = balance.opponentAvailable ?? 0;
    return `${team} team + ${opponent} opponent`;
  };

  // Determine if low on tokens (either type)
  const isLowTokens = balance && (balance.totalAvailable <= 1 ||
    (balance.teamAvailable ?? 0) === 0 ||
    (balance.opponentAvailable ?? 0) === 0);

  const isLowTeamTokens = balance && (balance.teamAvailable ?? 0) <= 1;
  const isLowOpponentTokens = balance && (balance.opponentAvailable ?? 0) <= 1;

  if (loading) {
    if (variant === 'compact') {
      return (
        <div className={`animate-pulse bg-gray-100 rounded-lg px-4 py-3 ${className}`}>
          <div className="h-4 bg-gray-200 rounded w-48"></div>
        </div>
      );
    }
    return (
      <div className={`animate-pulse bg-gray-50 rounded-lg p-6 ${className}`}>
        <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-48"></div>
      </div>
    );
  }

  if (error || !balance) {
    return null; // Silently fail - don't break the UI
  }

  // Compact variant - single line banner with designated token breakdown
  if (variant === 'compact') {
    const teamTokens = balance.teamAvailable ?? 0;
    const opponentTokens = balance.opponentAvailable ?? 0;

    return (
      <div
        className={`rounded-lg px-4 py-3 ${
          isLowTokens
            ? 'bg-amber-50 border border-amber-200'
            : 'bg-gray-50 border border-gray-200'
        } ${className}`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            {isLowTokens ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            ) : (
              <Upload className="h-4 w-4 text-gray-500 flex-shrink-0" />
            )}
            {/* Team tokens */}
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              <span className={isLowTeamTokens ? 'text-amber-800 font-medium' : 'text-gray-700'}>
                <span className="font-semibold">{teamTokens}</span> team
              </span>
            </div>
            {/* Opponent tokens */}
            <div className="flex items-center gap-1.5 text-sm">
              <Target className="h-3.5 w-3.5 text-orange-600" />
              <span className={isLowOpponentTokens ? 'text-amber-800 font-medium' : 'text-gray-700'}>
                <span className="font-semibold">{opponentTokens}</span> opponent
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {balance.periodEnd && (
              <span className="text-gray-500">
                Resets {formatPeriodEnd(balance.periodEnd)}
              </span>
            )}
            <Link
              href={`/teams/${teamId}/settings/addons`}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-1 font-medium"
            >
              Get more
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Full variant - detailed card for settings with designated token breakdown
  const teamTokens = balance.teamAvailable ?? 0;
  const opponentTokens = balance.opponentAvailable ?? 0;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Film Upload Tokens</h3>
        {isLowTokens && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <AlertTriangle className="h-3 w-3" />
            Low tokens
          </span>
        )}
      </div>

      {/* Designated token display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Team tokens */}
        <div className={`p-4 rounded-lg ${isLowTeamTokens ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Team Film</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-bold ${isLowTeamTokens ? 'text-amber-700' : 'text-gray-900'}`}>
              {teamTokens}
            </span>
            <span className="text-sm text-gray-500">available</span>
          </div>
          {(balance.monthlyTeamAllocation ?? 0) > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {balance.teamUsedThisPeriod ?? 0} of {balance.monthlyTeamAllocation} used
            </p>
          )}
        </div>

        {/* Opponent tokens */}
        <div className={`p-4 rounded-lg ${isLowOpponentTokens ? 'bg-amber-50 border border-amber-200' : 'bg-orange-50 border border-orange-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-gray-700">Opponent Scouting</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-bold ${isLowOpponentTokens ? 'text-amber-700' : 'text-gray-900'}`}>
              {opponentTokens}
            </span>
            <span className="text-sm text-gray-500">available</span>
          </div>
          {(balance.monthlyOpponentAllocation ?? 0) > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {balance.opponentUsedThisPeriod ?? 0} of {balance.monthlyOpponentAllocation} used
            </p>
          )}
        </div>
      </div>

      {/* Period info */}
      {balance.periodEnd && (
        <div className="p-3 bg-gray-50 rounded-lg mb-6">
          <p className="text-sm text-gray-600">
            Your tokens reset on{' '}
            <span className="font-medium text-gray-900">
              {new Date(balance.periodEnd).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </p>
        </div>
      )}

      {/* What are tokens explanation */}
      <div className="p-3 bg-blue-50 rounded-lg mb-6 border border-blue-100">
        <p className="text-sm text-blue-800">
          <strong>Team tokens</strong> are used when uploading your team&apos;s game film.{' '}
          <strong>Opponent tokens</strong> are used for scouting upcoming opponents.
        </p>
      </div>

      {/* Action button */}
      <Link
        href={`/teams/${teamId}/settings/addons`}
        className="block w-full text-center px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        Purchase additional tokens
      </Link>
    </div>
  );
}

// Export a hook for components that need token balance data directly
export function useTokenBalance(teamId: string) {
  const [balance, setBalance] = useState<TokenBalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tokens?team_id=${teamId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch token balance');
      }

      const data = await response.json();
      setBalance(data.balance);
      setError(null);
    } catch (err) {
      console.error('Error fetching token balance:', err);
      setError('Unable to load token balance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teamId) {
      refetch();
    }
  }, [teamId]);

  return { balance, loading, error, refetch };
}
