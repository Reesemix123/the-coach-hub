'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Upload, Trash2, Video, X,
  Grid3X3, List, Search, ChevronLeft, ChevronRight, SortAsc, SortDesc,
  Share2,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { FilmCaptureWithSport, ShareableUser } from '@/types/film-capture';
import { AGE_GROUPS } from '@/types/film-capture';

type Tab = 'mine' | 'shared' | 'all';

export default function FilmCapturePage() {
  const [loading, setLoading] = useState(true);
  const [captures, setCaptures] = useState<FilmCaptureWithSport[]>([]);
  const [sports, setSports] = useState<Array<{ id: string; name: string; icon: string | null }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [sportId, setSportId] = useState('');
  const [gameDate, setGameDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [opponent, setOpponent] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // View mode — persisted to localStorage
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('film-capture-view') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>('mine');

  // Sharing state
  const [shareableUsers, setShareableUsers] = useState<ShareableUser[]>([]);
  const [sharingCaptureId, setSharingCaptureId] = useState<string | null>(null);
  const [selectedShareUsers, setSelectedShareUsers] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [loadingCurrentShares, setLoadingCurrentShares] = useState(false);

  // Filters
  const [filterSport, setFilterSport] = useState('');
  const [filterAgeGroup, setFilterAgeGroup] = useState('');
  const [filterUploader, setFilterUploader] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const perPage = 20;

  // Uploaders list (admin only)
  const [uploaders, setUploaders] = useState<Array<{ id: string; name: string }>>([]);

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('film-capture-view', viewMode);
  }, [viewMode]);

  const fetchCaptures = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      if (filterSport) params.set('sport_id', filterSport);
      if (filterAgeGroup) params.set('age_group', filterAgeGroup);
      if (filterUploader) params.set('uploader_id', filterUploader);
      if (searchQuery) params.set('search', searchQuery);
      params.set('sort', sortOrder);
      params.set('page', String(page));
      params.set('per_page', String(perPage));

      const res = await fetch(`/api/film-capture?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCaptures(data.captures ?? []);
        setTotalPages(data.total_pages ?? 1);
        setTotalCount(data.total ?? 0);
      }
    } catch (err) {
      console.error('Failed to fetch captures:', err);
    }
  }, [activeTab, filterSport, filterAgeGroup, filterUploader, searchQuery, sortOrder, page]);

  // Fetch when any filter/pagination/tab dep changes
  useEffect(() => {
    fetchCaptures();
  }, [fetchCaptures]);

  // Reset to page 1 whenever tab or filters change (but not when page itself changes)
  useEffect(() => {
    setPage(1);
  }, [activeTab, filterSport, filterAgeGroup, filterUploader, searchQuery, sortOrder]);

  useEffect(() => {
    async function init() {
      const supabase = createClient();

      const { data: sportsData } = await supabase
        .from('sports')
        .select('id, name, icon')
        .in('status', ['active', 'internal'])
        .order('display_order');
      setSports(sportsData ?? []);

      // Check admin status
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_platform_admin')
          .eq('id', user.id)
          .maybeSingle();
        const adminFlag = profile?.is_platform_admin === true;
        setIsAdmin(adminFlag);

        // Fetch uploader list for admin filter dropdown
        if (adminFlag) {
          const { data: uploaderData } = await supabase
            .from('film_captures')
            .select('uploader_id');
          const uniqueIds = [...new Set((uploaderData ?? []).map(u => u.uploader_id as string))];
          if (uniqueIds.length > 0) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', uniqueIds);
            setUploaders(
              (profileData ?? []).map(p => ({
                id: p.id,
                name: (p.full_name as string | null) || (p.email as string | null) || p.id,
              }))
            );
          }
        }
      }

      // Fetch shareable users for the share modal
      try {
        const shareRes = await fetch('/api/film-capture/shareable-users');
        if (shareRes.ok) {
          const shareData = await shareRes.json();
          setShareableUsers(shareData.users ?? []);
        }
      } catch (err) {
        console.error('Failed to fetch shareable users:', err);
      }

      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the share modal opens, fetch existing shares for pre-checking
  useEffect(() => {
    if (!sharingCaptureId) {
      setSelectedShareUsers(new Set());
      return;
    }

    setLoadingCurrentShares(true);
    fetch(`/api/film-capture/${sharingCaptureId}/share`)
      .then(res => res.ok ? res.json() : { shares: [] })
      .then(data => {
        const alreadySharedIds = new Set<string>(
          (data.shares ?? []).map((s: { shared_with_user_id: string }) => s.shared_with_user_id)
        );
        setSelectedShareUsers(alreadySharedIds);
      })
      .catch(err => console.error('Failed to load current shares:', err))
      .finally(() => setLoadingCurrentShares(false));
  }, [sharingCaptureId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const uploadFile = file ?? (document.getElementById('film-file-input') as HTMLInputElement)?.files?.[0] ?? null;
    const effectiveGameDate = gameDate || (document.getElementById('film-game-date') as HTMLInputElement)?.value || '';
    const effectiveSportId = sportId || (document.getElementById('film-sport-select') as HTMLSelectElement)?.value || '';
    if (!uploadFile || !effectiveSportId || !effectiveGameDate) {
      setError('Please fill in all required fields and select a video file.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress('Uploading to storage...');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const timestamp = Date.now();
      const sanitizedName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${user.id}/${timestamp}_${sanitizedName}`;

      const { error: storageError } = await supabase.storage
        .from('film_captures')
        .upload(storagePath, uploadFile, {
          contentType: uploadFile.type,
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      setUploadProgress('Saving metadata...');

      const res = await fetch('/api/film-capture/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport_id: effectiveSportId,
          game_date: effectiveGameDate,
          opponent: opponent.trim() || null,
          age_group: ageGroup || null,
          storage_path: storagePath,
          file_name: uploadFile.name,
          file_size_bytes: uploadFile.size,
          mime_type: uploadFile.type,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await supabase.storage.from('film_captures').remove([storagePath]);
        throw new Error(data.error || 'Failed to save capture record');
      }

      setSuccess('Film uploaded successfully');
      setFile(null);
      setSportId('');
      setGameDate('');
      setOpponent('');
      setAgeGroup('');
      const fileInput = document.getElementById('film-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Switch to "My Uploads" tab so the user sees their new upload
      setActiveTab('mine');
      await fetchCaptures();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleDelete(captureId: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    setDeletingId(captureId);
    try {
      const res = await fetch(`/api/film-capture/${captureId}`, { method: 'DELETE' });
      if (res.ok) {
        setCaptures(prev => prev.filter(c => c.id !== captureId));
        setTotalCount(prev => Math.max(0, prev - 1));
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleShare() {
    if (!sharingCaptureId) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/film-capture/${sharingCaptureId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: Array.from(selectedShareUsers) }),
      });
      if (res.ok) {
        setSharingCaptureId(null);
        setSelectedShareUsers(new Set());
        setSuccess('Video sharing updated');
        await fetchCaptures();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update sharing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sharing');
    } finally {
      setSharing(false);
    }
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function openShareModal(captureId: string) {
    setSharingCaptureId(captureId);
  }

  function closeShareModal() {
    setSharingCaptureId(null);
    setSelectedShareUsers(new Set());
  }

  const hasActiveFilters = !!(filterSport || filterAgeGroup || filterUploader || searchQuery);

  // Heading text depends on the active tab
  const libraryHeading =
    activeTab === 'all' ? 'All Uploads' :
    activeTab === 'shared' ? 'Shared with Me' :
    'Your Uploads';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Film Capture</h1>
        <p className="text-sm text-gray-500 mt-1">Upload and manage game film across all sports.</p>

        {/* Error banner */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Success banner */}
        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center justify-between">
            {success}
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Upload Form */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Game Film</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sport *</label>
                <select
                  id="film-sport-select"
                  value={sportId}
                  onChange={e => setSportId(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                >
                  <option value="">Select sport...</option>
                  {sports.map(s => (
                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Game Date *</label>
                <input
                  id="film-game-date"
                  type="date"
                  value={gameDate}
                  onChange={e => setGameDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opponent</label>
                <input
                  type="text"
                  value={opponent}
                  onChange={e => setOpponent(e.target.value)}
                  placeholder="e.g. Riverside Eagles"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age Group</label>
                <select
                  value={ageGroup}
                  onChange={e => setAgeGroup(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                >
                  <option value="">Select...</option>
                  {AGE_GROUPS.map(ag => (
                    <option key={ag} value={ag}>{ag}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video File *</label>
              <input
                id="film-file-input"
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-m4v,video/mpeg,.mp4,.mov,.webm,.avi,.m4v,.mpeg,.mpg"
                onChange={e => {
                  const selected = e.target.files?.[0] ?? null;
                  setFile(selected);
                  if (selected) setError(null);
                }}
                required
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              <p className="text-xs text-gray-400 mt-1">Max 5GB. Supported: MP4, MOV, WebM, AVI, M4V, MPEG</p>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploadProgress || 'Upload Film'}
            </button>
          </form>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex items-center gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'mine' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            My Uploads
            {activeTab === 'mine' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'shared' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Shared with Me
            {activeTab === 'shared' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === 'all' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Uploads
              {activeTab === 'all' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              title="Grid view"
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>

          {/* Sport filter */}
          <select
            value={filterSport}
            onChange={e => setFilterSport(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="">All Sports</option>
            {sports.map(s => (
              <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
            ))}
          </select>

          {/* Age group filter */}
          <select
            value={filterAgeGroup}
            onChange={e => setFilterAgeGroup(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="">All Age Groups</option>
            {AGE_GROUPS.map(ag => (
              <option key={ag} value={ag}>{ag}</option>
            ))}
          </select>

          {/* Uploader filter (admin + all tab only) */}
          {isAdmin && activeTab === 'all' && uploaders.length > 0 && (
            <select
              value={filterUploader}
              onChange={e => setFilterUploader(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="">All Uploaders</option>
              {uploaders.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-[150px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search opponent..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
            title={sortOrder === 'newest' ? 'Showing newest first' : 'Showing oldest first'}
          >
            {sortOrder === 'newest' ? <SortDesc size={14} /> : <SortAsc size={14} />}
            {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
          </button>
        </div>

        {/* Library */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {libraryHeading}
              {totalCount > 0 && (
                <span className="text-gray-400 font-normal ml-2">({totalCount})</span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : captures.length === 0 ? (
            <div className="text-center py-12">
              <Video size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {activeTab === 'shared'
                  ? 'No videos have been shared with you yet.'
                  : hasActiveFilters
                  ? 'No uploads match your filters.'
                  : 'No uploads yet.'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {captures.map(capture => (
                <div key={capture.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-900">
                    {capture.playback_url ? (
                      <video
                        preload="metadata"
                        className="w-full h-full object-cover"
                        onMouseOver={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                        onMouseOut={e => {
                          const v = e.target as HTMLVideoElement;
                          v.pause();
                          v.currentTime = 0;
                        }}
                        muted
                        loop
                      >
                        <source src={capture.playback_url} type={capture.mime_type || 'video/mp4'} />
                      </video>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video size={32} className="text-gray-600" />
                      </div>
                    )}

                    {/* Action buttons — only shown on hover */}
                    {activeTab === 'mine' && (
                      <>
                        {/* Share button */}
                        <button
                          onClick={e => { e.stopPropagation(); openShareModal(capture.id); }}
                          className="absolute top-2 right-10 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                          title="Share"
                        >
                          <Share2 size={14} />
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => handleDelete(capture.id, capture.file_name)}
                          disabled={deletingId === capture.id}
                          className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                          title="Delete"
                        >
                          {deletingId === capture.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />}
                        </button>
                      </>
                    )}

                    {/* Admin delete on all-tab */}
                    {activeTab === 'all' && (
                      <button
                        onClick={() => handleDelete(capture.id, capture.file_name)}
                        disabled={deletingId === capture.id}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                        title="Delete"
                      >
                        {deletingId === capture.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />}
                      </button>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <span>{capture.sport_icon || '🎥'}</span>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {capture.sport_name}{capture.opponent ? ` vs ${capture.opponent}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>{new Date(capture.game_date).toLocaleDateString()}</span>
                      {capture.age_group && <span>· {capture.age_group}</span>}
                      <span>· {formatFileSize(capture.file_size_bytes)}</span>
                    </div>

                    {/* Shared by (shared tab) */}
                    {activeTab === 'shared' && capture.shared_by_name && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        Shared by: {capture.shared_by_name}
                        {capture.shared_at && (
                          <span className="ml-1">
                            · {new Date(capture.shared_at).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    )}

                    {/* Admin uploader info */}
                    {activeTab === 'all' && capture.uploader_name && (
                      <p className="text-xs text-gray-400 mt-1 truncate">By: {capture.uploader_name}</p>
                    )}

                    {/* Share count indicator (mine tab) */}
                    {activeTab === 'mine' && (capture.share_count ?? 0) > 0 && (
                      <button
                        onClick={() => openShareModal(capture.id)}
                        className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Share2 size={11} />
                        Shared with {capture.share_count} {capture.share_count === 1 ? 'person' : 'people'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List view */
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className={`grid gap-3 px-4 py-2 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide ${
                activeTab === 'mine'
                  ? 'grid-cols-[2fr_1fr_1fr_1fr_5rem_3rem_3rem]'
                  : 'grid-cols-[2fr_1fr_1fr_1fr_5rem_3rem]'
              }`}>
                <span>Title</span>
                <span>Sport</span>
                <span>Date</span>
                <span>{activeTab === 'shared' ? 'Shared By' : 'Age Group'}</span>
                <span className="text-right">Size</span>
                {activeTab === 'mine' && <span></span>}
                <span></span>
              </div>
              {captures.map(capture => (
                <div
                  key={capture.id}
                  className={`grid gap-3 px-4 py-3 border-b border-gray-100 last:border-0 items-center hover:bg-gray-50 ${
                    activeTab === 'mine'
                      ? 'grid-cols-[2fr_1fr_1fr_1fr_5rem_3rem_3rem]'
                      : 'grid-cols-[2fr_1fr_1fr_1fr_5rem_3rem]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {capture.opponent ? `vs ${capture.opponent}` : capture.file_name}
                    </p>
                    {activeTab === 'all' && capture.uploader_name && (
                      <p className="text-xs text-gray-400 truncate">By: {capture.uploader_name}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">{capture.sport_icon} {capture.sport_name}</span>
                  <span className="text-sm text-gray-600">{new Date(capture.game_date).toLocaleDateString()}</span>
                  <span className="text-sm text-gray-600">
                    {activeTab === 'shared'
                      ? (capture.shared_by_name ?? '—')
                      : (capture.age_group || '—')}
                  </span>
                  <span className="text-sm text-gray-500 text-right">{formatFileSize(capture.file_size_bytes)}</span>

                  {/* Share button (mine tab only) */}
                  {activeTab === 'mine' && (
                    <button
                      onClick={() => openShareModal(capture.id)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                      title="Share"
                    >
                      <Share2 size={14} />
                    </button>
                  )}

                  {/* Delete (mine and all tabs) */}
                  {(activeTab === 'mine' || activeTab === 'all') && (
                    <button
                      onClick={() => handleDelete(capture.id, capture.file_name)}
                      disabled={deletingId === capture.id}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === capture.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  )}

                  {/* Placeholder cell for shared tab (no actions) */}
                  {activeTab === 'shared' && <span />}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {sharingCaptureId && (
        <div
          className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center"
          onClick={closeShareModal}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Share Video</h3>
            <p className="text-sm text-gray-500 mb-4">
              Select users to share this video with. Uncheck to revoke access.
            </p>

            {loadingCurrentShares ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : shareableUsers.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                No other users with film capture access.
              </p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {shareableUsers.map(u => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedShareUsers.has(u.id)}
                      onChange={e => {
                        setSelectedShareUsers(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(u.id);
                          else next.delete(u.id);
                          return next;
                        });
                      }}
                      className="rounded border-gray-300"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900">
                        {u.name}
                        <span className="ml-1.5 text-xs text-gray-400 font-normal">
                          {u.role === 'parent' ? 'Parent' : 'Coach'}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={handleShare}
                disabled={sharing || loadingCurrentShares}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {sharing && <Loader2 size={14} className="animate-spin" />}
                {selectedShareUsers.size === 0
                  ? 'Remove all shares'
                  : `Share with ${selectedShareUsers.size} ${selectedShareUsers.size === 1 ? 'person' : 'people'}`}
              </button>
              <button
                onClick={closeShareModal}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
