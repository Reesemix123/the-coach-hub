'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Upload, AlertTriangle, ArrowRight } from 'lucide-react';

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

  // Calculate team/opponent breakdown (tokens split evenly)
  const getBreakdown = (total: number): string => {
    const perType = Math.floor(total / 2);
    const remainder = total % 2;
    if (remainder > 0) {
      return `${perType + 1} team + ${perType} opponent`;
    }
    return `${perType} team + ${perType} opponent`;
  };

  // Determine if low on tokens
  const isLowTokens = balance && balance.totalAvailable <= 1;

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

  // Compact variant - single line banner
  if (variant === 'compact') {
    return (
      <div
        className={`rounded-lg px-4 py-3 ${
          isLowTokens
            ? 'bg-amber-50 border border-amber-200'
            : 'bg-gray-50 border border-gray-200'
        } ${className}`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {isLowTokens ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            ) : (
              <Upload className="h-4 w-4 text-gray-500 flex-shrink-0" />
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className={isLowTokens ? 'text-amber-800 font-medium' : 'text-gray-700'}>
                Film Uploads: <span className="font-semibold">{balance.totalAvailable}</span> remaining
              </span>
              {balance.totalAvailable > 0 && (
                <span className="text-gray-500">
                  ({getBreakdown(balance.totalAvailable)})
                </span>
              )}
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
              Purchase more
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Full variant - detailed card for settings
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Upload Tokens</h3>
        {isLowTokens && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <AlertTriangle className="h-3 w-3" />
            Low tokens
          </span>
        )}
      </div>

      {/* Main balance display */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-gray-900">
            {balance.totalAvailable}
          </span>
          <span className="text-gray-600">games available</span>
        </div>
        {balance.totalAvailable > 0 && (
          <p className="mt-1 text-sm text-gray-500">
            {getBreakdown(balance.totalAvailable)}
          </p>
        )}
      </div>

      {/* Balance breakdown */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">From subscription</span>
          <span className="font-medium text-gray-900">{balance.subscriptionAvailable}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Purchased tokens</span>
          <span className="font-medium text-gray-900">{balance.purchasedAvailable}</span>
        </div>
        {balance.monthlyAllocation > 0 && (
          <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
            <span className="text-gray-600">Used this period</span>
            <span className="font-medium text-gray-900">
              {balance.usedThisPeriod} of {balance.monthlyAllocation}
            </span>
          </div>
        )}
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

      {/* Action button */}
      <Link
        href={`/teams/${teamId}/settings/addons`}
        className="block w-full text-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
