'use client';

import { useState, useEffect } from 'react';
import { HardDrive, AlertTriangle, RefreshCw, Film } from 'lucide-react';

interface StorageUsage {
  team_id: string;
  total_bytes_used: number;
  file_count: number;
  quota_bytes: number;
  quota_used_percent: number;
  bytes_remaining: number;
  is_quota_exceeded: boolean;
  uploads_this_hour: number;
  max_uploads_per_hour: number;
  max_file_size_bytes: number;
  total_bytes_used_formatted: string;
  quota_bytes_formatted: string;
  bytes_remaining_formatted: string;
  max_file_size_formatted: string;
}

interface StorageUsageCardProps {
  teamId: string;
  compact?: boolean;
  showUploadStats?: boolean;
}

export default function StorageUsageCard({
  teamId,
  compact = false,
  showUploadStats = false,
}: StorageUsageCardProps) {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/teams/${teamId}/storage`);
      if (!response.ok) {
        throw new Error('Failed to fetch storage usage');
      }
      const data = await response.json();
      setUsage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, [teamId]);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-2 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      </div>
    );
  }

  if (!usage) return null;

  const usagePercent = usage.quota_used_percent;
  const isWarning = usagePercent >= 80 && usagePercent < 100;
  const isExceeded = usage.is_quota_exceeded;

  // Determine bar color
  const barColor = isExceeded
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-green-500';

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <HardDrive className={`h-4 w-4 ${isExceeded ? 'text-red-500' : 'text-gray-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>{usage.total_bytes_used_formatted} / {usage.quota_bytes_formatted}</span>
            <span>{usagePercent}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all duration-300`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-gray-600" />
          Video Storage
        </h3>
        <button
          onClick={fetchUsage}
          className="text-gray-400 hover:text-gray-600 p-1"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">
            {usage.total_bytes_used_formatted} used
          </span>
          <span className="text-gray-500">
            {usage.quota_bytes_formatted} total
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className={isExceeded ? 'text-red-600 font-medium' : 'text-gray-500'}>
            {usagePercent}% used
          </span>
          <span className="text-gray-500">
            {usage.bytes_remaining_formatted} remaining
          </span>
        </div>
      </div>

      {/* Warning/Error Messages */}
      {isExceeded && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Storage quota exceeded</p>
              <p className="text-red-600">
                Delete some videos or upgrade your plan to upload more.
              </p>
            </div>
          </div>
        </div>
      )}

      {isWarning && !isExceeded && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Storage running low</p>
              <p className="text-amber-600">
                Only {usage.bytes_remaining_formatted} remaining.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-gray-400" />
          <span className="text-gray-600">{usage.file_count} videos</span>
        </div>
        <div className="text-gray-600">
          Max file: {usage.max_file_size_formatted}
        </div>
      </div>

      {/* Upload Rate Stats */}
      {showUploadStats && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            Uploads this hour: {usage.uploads_this_hour} / {usage.max_uploads_per_hour}
          </div>
        </div>
      )}
    </div>
  );
}
