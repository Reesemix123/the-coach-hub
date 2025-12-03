'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Video,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Eye,
  Download,
  Trash2,
  Shield,
  FileVideo,
  HardDrive
} from 'lucide-react';

type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'removed';

interface VideoItem {
  id: string;
  name: string;
  file_path: string | null;
  url: string | null;
  file_size_bytes: number | null;
  file_size_formatted: string;
  mime_type: string | null;
  duration_seconds: number | null;
  moderation_status: ModerationStatus;
  uploaded_at: string;
  uploaded_by: string | null;
  uploader_email: string | null;
  uploader_name: string | null;
  upload_ip: string | null;
  moderated_at: string | null;
  moderated_by: string | null;
  moderator_email: string | null;
  moderation_notes: string | null;
  flagged_reason: string | null;
  game_id: string | null;
  game_name: string | null;
  team_id: string | null;
  team_name: string | null;
}

interface Stats {
  pending: number;
  approved: number;
  flagged: number;
  removed: number;
  total: number;
}

// Status styling
const STATUS_CONFIG: Record<ModerationStatus, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-4 h-4" />, label: 'Pending' },
  approved: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" />, label: 'Approved' },
  flagged: { color: 'bg-orange-100 text-orange-800', icon: <AlertTriangle className="w-4 h-4" />, label: 'Flagged' },
  removed: { color: 'bg-red-100 text-red-800', icon: <XCircle className="w-4 h-4" />, label: 'Removed' },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export default function ModerationPage() {
  // State
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, flagged: 0, removed: 0, total: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ModerationStatus | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState('');
  const [minSize, setMinSize] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Modal state
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [moderateModalOpen, setModerateModalOpen] = useState(false);
  const [moderateStatus, setModerateStatus] = useState<ModerationStatus>('approved');
  const [moderateReason, setModerateReason] = useState('');
  const [moderating, setModerating] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        status: statusFilter,
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (teamFilter) params.append('team_id', teamFilter);
      if (minSize) params.append('min_file_size', (parseInt(minSize) * 1024 * 1024).toString());
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const response = await fetch(`/api/admin/moderation?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      const data = await response.json();
      setVideos(data.videos || []);
      setStats(data.stats);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, debouncedSearch, teamFilter, minSize, dateFrom, dateTo]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch, teamFilter, minSize, dateFrom, dateTo]);

  // Moderate video
  const handleModerate = async () => {
    if (!selectedVideo) return;

    setModerating(true);
    try {
      const response = await fetch(`/api/admin/moderation/${selectedVideo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: moderateStatus,
          reason: moderateReason || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to moderate video');
      }

      // Refresh list
      await fetchVideos();
      setModerateModalOpen(false);
      setSelectedVideo(null);
      setModerateReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to moderate video');
    } finally {
      setModerating(false);
    }
  };

  // Quick actions
  const quickApprove = async (video: VideoItem) => {
    try {
      await fetch(`/api/admin/moderation/${video.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      fetchVideos();
    } catch (err) {
      setError('Failed to approve video');
    }
  };

  const quickFlag = async (video: VideoItem) => {
    setSelectedVideo(video);
    setModerateStatus('flagged');
    setModerateModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-gray-700" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Content Moderation</h1>
                <p className="text-sm text-gray-500 mt-1">Review and moderate uploaded videos</p>
              </div>
            </div>
            <button
              onClick={fetchVideos}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <button
            onClick={() => setStatusFilter('all')}
            className={`p-4 rounded-lg border transition-colors ${
              statusFilter === 'all' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <FileVideo className="w-4 h-4" />
              <span className="text-sm font-medium">Total</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
          </button>

          <button
            onClick={() => setStatusFilter('pending')}
            className={`p-4 rounded-lg border transition-colors ${
              statusFilter === 'pending' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{stats.pending}</p>
          </button>

          <button
            onClick={() => setStatusFilter('approved')}
            className={`p-4 rounded-lg border transition-colors ${
              statusFilter === 'approved' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Approved</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{stats.approved}</p>
          </button>

          <button
            onClick={() => setStatusFilter('flagged')}
            className={`p-4 rounded-lg border transition-colors ${
              statusFilter === 'flagged' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Flagged</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{stats.flagged}</p>
          </button>

          <button
            onClick={() => setStatusFilter('removed')}
            className={`p-4 rounded-lg border transition-colors ${
              statusFilter === 'removed' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Removed</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{stats.removed}</p>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {/* Search */}
            <div className="col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by video name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>
            </div>

            {/* Min file size */}
            <div>
              <div className="relative">
                <HardDrive className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  placeholder="Min size (MB)"
                  value={minSize}
                  onChange={(e) => setMinSize(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>
            </div>

            {/* Date from */}
            <div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>

            {/* Date to */}
            <div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Videos Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Video</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Team</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Uploader</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Uploaded</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading videos...
                  </td>
                </tr>
              ) : videos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <Video className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    No videos found
                  </td>
                </tr>
              ) : (
                videos.map((video) => (
                  <tr key={video.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                          <Video className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={video.name}>
                            {video.name}
                          </p>
                          <p className="text-xs text-gray-500">{video.mime_type || 'Unknown type'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-900">{video.team_name || '-'}</p>
                        <p className="text-xs text-gray-500">{video.game_name || '-'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900">{video.file_size_formatted}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-900">{video.uploader_email || 'Unknown'}</p>
                        {video.upload_ip && (
                          <p className="text-xs text-gray-500 font-mono">{video.upload_ip}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500" title={video.uploaded_at ? formatDate(video.uploaded_at) : ''}>
                        {formatRelativeTime(video.uploaded_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[video.moderation_status].color}`}>
                        {STATUS_CONFIG[video.moderation_status].icon}
                        {STATUS_CONFIG[video.moderation_status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {video.url && (
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            title="View video"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        )}
                        {video.moderation_status !== 'approved' && (
                          <button
                            onClick={() => quickApprove(video)}
                            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {video.moderation_status !== 'flagged' && (
                          <button
                            onClick={() => quickFlag(video)}
                            className="p-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded"
                            title="Flag for review"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedVideo(video);
                            setModerateStatus(video.moderation_status);
                            setModerateModalOpen(true);
                          }}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                          title="Moderate"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} of {total} videos
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Moderate Modal */}
      {moderateModalOpen && selectedVideo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Moderate Video</h3>
              <p className="text-sm text-gray-500 mt-1 truncate">{selectedVideo.name}</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Status selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['approved', 'flagged', 'removed', 'pending'] as ModerationStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setModerateStatus(status)}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        moderateStatus === status
                          ? `${STATUS_CONFIG[status].color} border-current`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {STATUS_CONFIG[status].icon}
                      <span className="text-sm font-medium">{STATUS_CONFIG[status].label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason {(moderateStatus === 'flagged' || moderateStatus === 'removed') && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={moderateReason}
                  onChange={(e) => setModerateReason(e.target.value)}
                  placeholder="Enter reason for this action..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>

              {/* Video info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-gray-600">
                  <div>
                    <span className="font-medium">Size:</span> {selectedVideo.file_size_formatted}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {selectedVideo.mime_type || 'Unknown'}
                  </div>
                  <div>
                    <span className="font-medium">Team:</span> {selectedVideo.team_name || '-'}
                  </div>
                  <div>
                    <span className="font-medium">Uploader:</span> {selectedVideo.uploader_email || 'Unknown'}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setModerateModalOpen(false);
                  setSelectedVideo(null);
                  setModerateReason('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModerate}
                disabled={moderating || ((moderateStatus === 'flagged' || moderateStatus === 'removed') && !moderateReason)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {moderating ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
