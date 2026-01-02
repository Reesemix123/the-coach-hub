'use client';

import Link from 'next/link';
import { AlertTriangle, Calendar, ShoppingCart, Users, Target, ArrowRight } from 'lucide-react';

export type TokenType = 'team' | 'opponent';

interface TokenLimitMessageProps {
  tokenType: TokenType;
  teamId: string;
  periodEnd?: Date | string | null;
  otherTokensAvailable?: number;
  className?: string;
}

/**
 * TokenLimitMessage - Contextual message when user is blocked due to no tokens
 *
 * Shows:
 * - Clear explanation of WHY they're blocked
 * - When tokens reset (if applicable)
 * - Link to purchase more
 * - Hint about other token type availability
 */
export function TokenLimitMessage({
  tokenType,
  teamId,
  periodEnd,
  otherTokensAvailable,
  className = ''
}: TokenLimitMessageProps) {
  const isTeam = tokenType === 'team';
  const Icon = isTeam ? Users : Target;
  const iconColor = isTeam ? 'text-blue-600' : 'text-orange-600';
  const bgColor = 'bg-amber-50';
  const borderColor = 'border-amber-200';

  const typeLabel = isTeam ? 'team film' : 'opponent scouting';
  const otherTypeLabel = isTeam ? 'opponent scouting' : 'team film';

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  };

  return (
    <div className={`${bgColor} border ${borderColor} rounded-xl p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="p-2 bg-amber-100 rounded-lg">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-amber-900 mb-2">
            No {typeLabel} uploads available
          </h3>
          <p className="text-amber-800 mb-4">
            You&apos;ve used all your {typeLabel} tokens for this billing period.
          </p>

          {/* Options */}
          <div className="space-y-3">
            {/* Purchase option */}
            <Link
              href={`/teams/${teamId}/settings/addons`}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-amber-200 hover:border-amber-400 transition-colors"
            >
              <ShoppingCart className="w-5 h-5 text-gray-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Purchase more tokens</p>
                <p className="text-sm text-gray-500">Get additional {typeLabel} uploads instantly</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>

            {/* Wait for reset option */}
            {periodEnd && (
              <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg border border-amber-100">
                <Calendar className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-700">
                    Your monthly tokens reset on <span className="font-medium">{formatDate(periodEnd)}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Other tokens available hint */}
            {otherTokensAvailable !== undefined && otherTokensAvailable > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <Icon className={`w-5 h-5 ${isTeam ? 'text-orange-600' : 'text-blue-600'}`} />
                <div>
                  <p className="text-sm text-blue-800">
                    You still have <span className="font-semibold">{otherTokensAvailable}</span> {otherTypeLabel} token{otherTokensAvailable !== 1 ? 's' : ''} available
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TokenLimitBanner - Compact inline warning when low on tokens
 */
interface TokenLimitBannerProps {
  tokenType: TokenType;
  tokensRemaining: number;
  teamId: string;
  periodEnd?: Date | string | null;
  className?: string;
}

export function TokenLimitBanner({
  tokenType,
  tokensRemaining,
  teamId,
  periodEnd,
  className = ''
}: TokenLimitBannerProps) {
  const isTeam = tokenType === 'team';
  const Icon = isTeam ? Users : Target;
  const typeLabel = isTeam ? 'team film' : 'opponent scouting';

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (tokensRemaining > 1) return null;

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-800">
            {tokensRemaining === 0 ? (
              <>No {typeLabel} tokens remaining</>
            ) : (
              <>Only <strong>1</strong> {typeLabel} token remaining</>
            )}
          </span>
          {periodEnd && (
            <span className="text-sm text-amber-600">
              (resets {formatDate(periodEnd)})
            </span>
          )}
        </div>
        <Link
          href={`/teams/${teamId}/settings/addons`}
          className="text-sm font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1"
        >
          Get more
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export default TokenLimitMessage;
