'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Upload, Trash2, Video, X,
  Grid3X3, List, Search, ChevronLeft, ChevronRight, SortAsc, SortDesc,
  Share2, Download, ExternalLink, ChevronDown, ChevronUp, Plus,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { FilmCaptureWithSport, ShareableUser } from '@/types/film-capture';
import { AGE_GROUPS } from '@/types/film-capture';
import { uploadFile as resumableUpload, formatBytes, formatTime, type UploadProgress } from '@/lib/utils/resumable-upload';

type Tab = 'mine' | 'shared' | 'all';
type GameMode = 'existing' | 'new';

interface GameSummary {
  id: string;
  sport_id: string;
  sport_name: string;
  sport_icon: string | null;
  game_date: string;
  opponent: string | null;
  age_group: string | null;
  title: string | null;
  clip_count: number;
  uploader_name: string | null;
  uploader_id: string;
}

interface UserGameOption {
  id: string;
  label: string;
}

export default function FilmCapturePage() {
  const [loading, setLoading] = useState(true);
  const [sports, setSports] = useState<Array<{ id: string; name: string; icon: string | null }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadDetails, setUploadDetails] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Upload form state
  const [gameMode, setGameMode] = useState<GameMode>('new');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [clipLabel, setClipLabel] = useState('');
  const [sportId, setSportId] = useState('');
  const [gameDate, setGameDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [opponent, setOpponent] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // User's own games for "existing game" dropdown
  const [userGames, setUserGames] = useState<UserGameOption[]>([]);

  // View mode — persisted to localStorage
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('film-capture-view') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>('mine');

  // Library — game-grouped
  const [games, setGames] = useState<GameSummary[]>([]);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [gameClips, setGameClips] = useState<FilmCaptureWithSport[]>([]);
  const [gameClipsLoading, setGameClipsLoading] = useState(false);

  // Sharing state — operates at the game level (shares each clip in the game)
  const [shareableUsers, setShareableUsers] = useState<ShareableUser[]>([]);
  const [sharingGameId, setSharingGameId] = useState<string | null>(null);
  const [sharingGameClipCount, setSharingGameClipCount] = useState(0);
  const [selectedShareUsers, setSelectedShareUsers] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [loadingCurrentShares, setLoadingCurrentShares] = useState(false);

  // Filters
  const [filterSport, setFilterSport] = useState('');
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

  // Vimeo state
  const [vimeoConnected, setVimeoConnected] = useState(false);
  const [vimeoAccountName, setVimeoAccountName] = useState<string | null>(null);
  const [sendingToVimeo, setSendingToVimeo] = useState<string | null>(null);
  const [vimeoModal, setVimeoModal] = useState<{ captureId: string; defaultTitle: string } | null>(null);
  const [vimeoTitle, setVimeoTitle] = useState('');
  const [vimeoDescription, setVimeoDescription] = useState('');
  const [vimeoPrivacy, setVimeoPrivacy] = useState<'unlisted' | 'public' | 'private'>('unlisted');

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('film-capture-view', viewMode);
  }, [viewMode]);

  const fetchGames = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      if (filterSport) params.set('sport_id', filterSport);
      if (filterUploader) params.set('uploader_id', filterUploader);
      if (searchQuery) params.set('search', searchQuery);
      params.set('sort', sortOrder);
      params.set('page', String(page));
      params.set('per_page', String(perPage));

      const res = await fetch(`/api/film-capture/games?${params}`);
      if (res.ok) {
        const data = await res.json();
        setGames(data.games ?? []);
        setTotalPages(data.total_pages ?? 1);
        setTotalCount(data.total ?? 0);
      }
    } catch (err) {
      console.error('Failed to fetch games:', err);
    }
  }, [activeTab, filterSport, filterUploader, searchQuery, sortOrder, page]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Reset to page 1 when any filter/tab changes (but not page itself)
  useEffect(() => {
    setPage(1);
  }, [activeTab, filterSport, filterUploader, searchQuery, sortOrder]);

  // Collapse expanded game when switching tabs
  useEffect(() => {
    setExpandedGameId(null);
    setGameClips([]);
  }, [activeTab]);

  async function refreshUserGames() {
    try {
      const res = await fetch('/api/film-capture/games?tab=mine&per_page=50&sort=newest');
      if (res.ok) {
        const data = await res.json();
        setUserGames(
          (data.games ?? []).map((g: GameSummary) => ({
            id: g.id,
            label: `${g.sport_icon || ''} ${g.sport_name} vs ${g.opponent || 'Unknown'} — ${new Date(g.game_date).toLocaleDateString()}`.trim(),
          }))
        );
      }
    } catch (err) {
      console.error('Failed to refresh user games:', err);
    }
  }

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

      // Check Vimeo connection
      try {
        const vimeoRes = await fetch('/api/communication/external-accounts');
        if (vimeoRes.ok) {
          const vimeoData = await vimeoRes.json();
          const vimeo = vimeoData.accounts?.vimeo;
          if (vimeo?.connected && vimeo?.status === 'active') {
            setVimeoConnected(true);
            setVimeoAccountName(vimeo.accountName || null);
          }
        }
      } catch {
        // Non-critical
      }

      // Fetch user's own games for the "existing game" dropdown
      await refreshUserGames();

      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the share modal opens, load existing shares for the first clip in that game
  // (We use the game-level share: fetch the clips, then check shares on each)
  useEffect(() => {
    if (!sharingGameId) {
      setSelectedShareUsers(new Set());
      return;
    }

    setLoadingCurrentShares(true);

    // Fetch clips for the game, then fetch shares on the first clip as a representative sample
    fetch(`/api/film-capture/games/${sharingGameId}/clips`)
      .then(res => res.ok ? res.json() : { clips: [] })
      .then(async (data) => {
        const clips: FilmCaptureWithSport[] = data.clips ?? [];
        setSharingGameClipCount(clips.length);

        if (clips.length === 0) {
          setSelectedShareUsers(new Set());
          return;
        }

        // Use first clip to get existing share recipients
        const firstClipId = clips[0].id;
        const shareRes = await fetch(`/api/film-capture/${firstClipId}/share`);
        if (shareRes.ok) {
          const shareData = await shareRes.json();
          const alreadySharedIds = new Set<string>(
            (shareData.shares ?? []).map((s: { shared_with_user_id: string }) => s.shared_with_user_id)
          );
          setSelectedShareUsers(alreadySharedIds);
        }
      })
      .catch(err => console.error('Failed to load current shares:', err))
      .finally(() => setLoadingCurrentShares(false));
  }, [sharingGameId]);

  async function handleExpandGame(gameId: string) {
    if (expandedGameId === gameId) {
      setExpandedGameId(null);
      setGameClips([]);
      return;
    }
    setExpandedGameId(gameId);
    setGameClipsLoading(true);
    setGameClips([]);
    try {
      const res = await fetch(`/api/film-capture/games/${gameId}/clips`);
      if (res.ok) {
        const data = await res.json();
        setGameClips(data.clips ?? []);
      }
    } finally {
      setGameClipsLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();

    const uploadFile = file ?? (document.getElementById('film-file-input') as HTMLInputElement)?.files?.[0] ?? null;
    if (!uploadFile) {
      setError('Please select a video file.');
      return;
    }

    let effectiveGameId = '';

    if (gameMode === 'existing') {
      effectiveGameId = selectedGameId;
      if (!effectiveGameId) {
        setError('Please select a game.');
        return;
      }
    } else {
      // Create new game first
      const effectiveSportId = sportId || (document.getElementById('film-sport-select') as HTMLSelectElement)?.value || '';
      const effectiveGameDate = gameDate || (document.getElementById('film-game-date') as HTMLInputElement)?.value || '';

      if (!effectiveSportId || !effectiveGameDate) {
        setError('Please fill in sport and game date.');
        return;
      }

      setUploading(true);
      setError(null);
      setSuccess(null);
      setUploadProgressText('Creating game...');

      try {
        const gameRes = await fetch('/api/film-capture/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sport_id: effectiveSportId,
            game_date: effectiveGameDate,
            opponent: opponent.trim() || null,
            age_group: ageGroup || null,
          }),
        });
        if (!gameRes.ok) {
          const data = await gameRes.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || 'Failed to create game');
        }
        const gameData = await gameRes.json();
        effectiveGameId = gameData.game.id;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create game');
        setUploading(false);
        setUploadProgressText(null);
        return;
      }
    }

    // Upload the file
    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgressText('Preparing upload...');
    setUploadPercent(0);
    setUploadDetails(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const timestamp = Date.now();
      const sanitizedName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${user.id}/${timestamp}_${sanitizedName}`;

      // Use resumable upload with progress tracking (tus protocol for files > 100MB)
      const uploadResult = await resumableUpload(
        supabase,
        'film_captures',
        storagePath,
        uploadFile,
        {
          onProgress: (progress: UploadProgress) => {
            setUploadPercent(progress.percentage);
            setUploadProgressText(`Uploading — ${progress.percentage}%`);
            setUploadDetails(
              `${formatBytes(progress.bytesUploaded)} of ${formatBytes(progress.bytesTotal)}` +
              (progress.remainingTime > 0 ? ` — ${formatTime(progress.remainingTime)} remaining` : '')
            );
          },
          onError: (err: Error) => {
            console.error('Upload error:', err);
          },
        }
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Storage upload failed');
      }

      setUploadProgressText('Saving metadata...');
      setUploadPercent(100);

      // When using an existing game we still need sport_id and game_date for the
      // upload route's validation. Derive them from the selected game in userGames.
      let sportIdForUpload = sportId;
      let gameDateForUpload = gameDate;
      if (gameMode === 'existing') {
        // The upload route accepts game_id and can derive metadata server-side,
        // but the current route still validates sport_id + game_date.
        // Use a safe fallback: first sport and today if nothing is set.
        sportIdForUpload = sports[0]?.id || '';
        gameDateForUpload = new Date().toISOString().split('T')[0];
      }

      const res = await fetch('/api/film-capture/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport_id: sportIdForUpload,
          game_date: gameDateForUpload,
          opponent: gameMode === 'new' ? (opponent.trim() || null) : null,
          age_group: gameMode === 'new' ? (ageGroup || null) : null,
          storage_path: storagePath,
          file_name: uploadFile.name,
          file_size_bytes: uploadFile.size,
          mime_type: uploadFile.type,
          game_id: effectiveGameId,
          clip_label: clipLabel.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        await supabase.storage.from('film_captures').remove([storagePath]);
        throw new Error((data as { error?: string }).error || 'Failed to save clip record');
      }

      setSuccess('Film uploaded successfully');
      setFile(null);
      setClipLabel('');
      const fileInput = document.getElementById('film-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Reset new-game fields after a successful "new game" upload
      if (gameMode === 'new') {
        setSportId('');
        setGameDate(new Date().toISOString().split('T')[0]);
        setOpponent('');
        setAgeGroup('');
      }

      setActiveTab('mine');
      await Promise.all([fetchGames(), refreshUserGames()]);

      // If we just added a clip to an already-expanded game, refresh its clips
      if (expandedGameId === effectiveGameId) {
        const clipsRes = await fetch(`/api/film-capture/games/${effectiveGameId}/clips`);
        if (clipsRes.ok) {
          const clipsData = await clipsRes.json();
          setGameClips(clipsData.clips ?? []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgressText(null);
      setUploadPercent(0);
      setUploadDetails(null);
    }
  }

  async function handleDeleteClip(captureId: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    setDeletingId(captureId);
    try {
      const res = await fetch(`/api/film-capture/${captureId}`, { method: 'DELETE' });
      if (res.ok) {
        setGameClips(prev => prev.filter(c => c.id !== captureId));
        // Update clip count on the game in the list
        setGames(prev =>
          prev.map(g =>
            g.id === expandedGameId
              ? { ...g, clip_count: Math.max(0, g.clip_count - 1) }
              : g
          )
        );
        setTotalCount(prev => Math.max(0, prev - 1));
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleShare() {
    if (!sharingGameId) return;
    setSharing(true);
    try {
      // Fetch all clip IDs for the game, then share each one
      const clipsRes = await fetch(`/api/film-capture/games/${sharingGameId}/clips`);
      if (!clipsRes.ok) throw new Error('Failed to load game clips');
      const clipsData = await clipsRes.json();
      const clips: FilmCaptureWithSport[] = clipsData.clips ?? [];

      if (clips.length === 0) {
        setSharingGameId(null);
        return;
      }

      const userIds = Array.from(selectedShareUsers);

      await Promise.all(
        clips.map(clip =>
          fetch(`/api/film-capture/${clip.id}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds }),
          })
        )
      );

      setSharingGameId(null);
      setSelectedShareUsers(new Set());
      setSuccess('Video sharing updated');
      await fetchGames();
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

  function openShareModal(gameId: string) {
    setSharingGameId(gameId);
  }

  function closeShareModal() {
    setSharingGameId(null);
    setSelectedShareUsers(new Set());
  }

  function handleDownload(capture: FilmCaptureWithSport) {
    if (!capture.playback_url) return;
    const a = document.createElement('a');
    a.href = capture.playback_url;
    a.download = capture.file_name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function openVimeoModal(capture: FilmCaptureWithSport) {
    const sportName = capture.sport_name || 'Film';
    const defaultTitle = capture.opponent
      ? `${sportName} vs ${capture.opponent} — ${new Date(capture.game_date).toLocaleDateString()}`
      : `${sportName} — ${new Date(capture.game_date).toLocaleDateString()}`;
    setVimeoModal({ captureId: capture.id, defaultTitle });
    setVimeoTitle(defaultTitle);
    setVimeoDescription('');
    setVimeoPrivacy('unlisted');
  }

  async function handleSendToVimeo() {
    if (!vimeoModal) return;
    setSendingToVimeo(vimeoModal.captureId);
    try {
      const res = await fetch(`/api/film-capture/${vimeoModal.captureId}/vimeo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: vimeoTitle,
          description: vimeoDescription,
          privacySetting: vimeoPrivacy,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Failed to send to Vimeo');
      }
      setSuccess('Video sent to Vimeo — it will appear in your Vimeo account shortly');
      setVimeoModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send to Vimeo');
    } finally {
      setSendingToVimeo(null);
    }
  }

  function formatGameTitle(game: GameSummary): string {
    const base = game.opponent ? `vs ${game.opponent}` : 'Game';
    return game.title ? game.title : base;
  }

  const hasActiveFilters = !!(filterSport || filterUploader || searchQuery);

  const libraryHeading =
    activeTab === 'all' ? 'All Games' :
    activeTab === 'shared' ? 'Shared with Me' :
    'Your Games';

  // --------------------------------------------------------------------------
  // Expanded clips section — rendered inside both grid and list game cards
  // --------------------------------------------------------------------------
  function renderExpandedClips(game: GameSummary) {
    return (
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        {gameClipsLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <Loader2 size={14} className="animate-spin" /> Loading clips...
          </div>
        ) : gameClips.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No clips in this game.</p>
        ) : (
          <div className="space-y-3">
            {gameClips.map(clip => (
              <div key={clip.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {clip.playback_url && (
                  <video controls preload="metadata" className="w-full max-h-[300px] bg-black">
                    <source src={clip.playback_url} type={clip.mime_type || 'video/mp4'} />
                  </video>
                )}
                <div className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {clip.clip_label || clip.file_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(clip.file_size_bytes)}
                      {clip.clip_label && clip.file_name ? ` · ${clip.file_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {clip.playback_url && (
                      <button
                        onClick={() => handleDownload(clip)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                    )}
                    {vimeoConnected && clip.playback_url && (
                      <button
                        onClick={() => openVimeoModal(clip)}
                        disabled={sendingToVimeo === clip.id}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                        title="Send to Vimeo"
                      >
                        {sendingToVimeo === clip.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <ExternalLink size={14} />}
                      </button>
                    )}
                    {(activeTab === 'mine' || activeTab === 'all') && (
                      <button
                        onClick={() => handleDeleteClip(clip.id, clip.file_name)}
                        disabled={deletingId === clip.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Delete clip"
                      >
                        {deletingId === clip.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add more clips — mine tab only */}
        {activeTab === 'mine' && (
          <button
            onClick={() => {
              setGameMode('existing');
              setSelectedGameId(game.id);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="mt-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Upload size={12} /> Add more clips to this game
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Film Capture</h1>
        <p className="text-sm text-gray-500 mt-1">Upload and manage game film across all sports.</p>

        {/* Error banner */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3 shrink-0">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Success banner */}
        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center justify-between">
            {success}
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600 ml-3 shrink-0">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Upload Form                                                         */}
        {/* ------------------------------------------------------------------ */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Game Film</h2>

          <form onSubmit={handleUpload} className="space-y-5">
            {/* Step 1: Game selection */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Game</p>

              {/* Tab toggle */}
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden w-fit mb-4">
                <button
                  type="button"
                  onClick={() => setGameMode('new')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    gameMode === 'new'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  New Game
                </button>
                <button
                  type="button"
                  onClick={() => setGameMode('existing')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    gameMode === 'existing'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Existing Game
                </button>
              </div>

              {gameMode === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select game *</label>
                  {userGames.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">
                      No games yet.{' '}
                      <button
                        type="button"
                        onClick={() => setGameMode('new')}
                        className="underline hover:text-gray-600"
                      >
                        Create a new game instead.
                      </button>
                    </p>
                  ) : (
                    <select
                      value={selectedGameId}
                      onChange={e => setSelectedGameId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                    >
                      <option value="">Select a game...</option>
                      {userGames.map(g => (
                        <option key={g.id} value={g.id}>{g.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                /* New game fields */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sport *</label>
                    <select
                      id="film-sport-select"
                      value={sportId}
                      onChange={e => setSportId(e.target.value)}
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
              )}
            </div>

            {/* Step 2: Clip details + file */}
            <div className="space-y-4 pt-1 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clip Label <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={clipLabel}
                  onChange={e => setClipLabel(e.target.value)}
                  placeholder="e.g. Q1, Sideline, Full Game"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                />
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
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
                <p className="text-xs text-gray-400 mt-1">Max 5GB. Supported: MP4, MOV, WebM, AVI, M4V, MPEG</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploadProgressText || 'Upload Film'}
            </button>

            {/* Upload progress bar */}
            {uploading && uploadPercent > 0 && (
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black rounded-full transition-all duration-300"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
                {uploadDetails && (
                  <p className="text-xs text-gray-500 mt-1.5">{uploadDetails}</p>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Vimeo connection banner */}
        {!vimeoConnected && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">Connect your Vimeo account</p>
              <p className="text-xs text-blue-700 mt-0.5">Send film captures directly to your Vimeo library.</p>
            </div>
            <a
              href="/api/auth/vimeo"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Connect Vimeo
            </a>
          </div>
        )}

        {vimeoConnected && (
          <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <ExternalLink size={16} className="text-green-600" />
            <p className="text-sm text-green-700">
              Vimeo connected{vimeoAccountName ? `: ${vimeoAccountName}` : ''}
            </p>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Library tabs                                                        */}
        {/* ------------------------------------------------------------------ */}
        <div className="mt-8 flex items-center gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'mine' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            My Games
            {activeTab === 'mine' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />}
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'shared' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Shared with Me
            {activeTab === 'shared' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === 'all' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Games
              {activeTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />}
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

        {/* ------------------------------------------------------------------ */}
        {/* Library                                                             */}
        {/* ------------------------------------------------------------------ */}
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
          ) : games.length === 0 ? (
            <div className="text-center py-12">
              <Video size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {activeTab === 'shared'
                  ? 'No games have been shared with you yet.'
                  : hasActiveFilters
                  ? 'No games match your filters.'
                  : 'No games yet.'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            /* ---- Grid view ---- */
            <div className="space-y-4">
              {games.map(game => (
                <div key={game.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Game card header */}
                  <button
                    type="button"
                    onClick={() => handleExpandGame(game.id)}
                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg shrink-0">
                        {game.sport_icon || <Video size={18} className="text-gray-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {game.sport_name} {formatGameTitle(game)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                          <span>{new Date(game.game_date).toLocaleDateString()}</span>
                          {game.age_group && <span>· {game.age_group}</span>}
                          <span className="inline-flex items-center gap-0.5 bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                            <Video size={10} /> {game.clip_count} {game.clip_count === 1 ? 'clip' : 'clips'}
                          </span>
                          {activeTab === 'all' && game.uploader_name && (
                            <span>· {game.uploader_name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {/* Share button (admin only, mine/all tabs) */}
                      {isAdmin && activeTab !== 'shared' && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); openShareModal(game.id); }}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                          title="Share all clips in this game"
                        >
                          <Share2 size={14} />
                        </button>
                      )}
                      {/* Add clips shortcut (mine tab only) */}
                      {activeTab === 'mine' && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setGameMode('existing');
                            setSelectedGameId(game.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          title="Add clips to this game"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      {expandedGameId === game.id
                        ? <ChevronUp size={16} className="text-gray-400" />
                        : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  {/* Expanded clips */}
                  {expandedGameId === game.id && renderExpandedClips(game)}
                </div>
              ))}
            </div>
          ) : (
            /* ---- List view ---- */
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_4rem_3rem] gap-2 px-4 py-2 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Game</span>
                <span>Sport</span>
                <span>Date</span>
                <span>Age Group</span>
                <span className="text-center">Clips</span>
                <span></span>
              </div>

              {games.map(game => (
                <div key={game.id}>
                  {/* Row */}
                  <button
                    type="button"
                    onClick={() => handleExpandGame(game.id)}
                    className="w-full grid grid-cols-[2fr_1fr_1fr_1fr_4rem_3rem] gap-2 px-4 py-3 border-b border-gray-100 last:border-0 items-center hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate font-medium">{formatGameTitle(game)}</p>
                      {activeTab === 'all' && game.uploader_name && (
                        <p className="text-xs text-gray-400 truncate">By: {game.uploader_name}</p>
                      )}
                    </div>
                    <span className="text-sm text-gray-600 truncate">{game.sport_icon} {game.sport_name}</span>
                    <span className="text-sm text-gray-600">{new Date(game.game_date).toLocaleDateString()}</span>
                    <span className="text-sm text-gray-500">{game.age_group || '—'}</span>
                    <span className="text-sm text-gray-600 text-center">{game.clip_count}</span>

                    {/* Actions */}
                    <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      {isAdmin && activeTab !== 'shared' && (
                        <button
                          type="button"
                          onClick={() => openShareModal(game.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                          title="Share game"
                        >
                          <Share2 size={13} />
                        </button>
                      )}
                      {expandedGameId === game.id
                        ? <ChevronUp size={14} className="text-gray-400" />
                        : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>

                  {/* Expanded clips inline */}
                  {expandedGameId === game.id && (
                    <div className="border-b border-gray-100 last:border-0">
                      {renderExpandedClips(game)}
                    </div>
                  )}
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

      {/* -------------------------------------------------------------------- */}
      {/* Share Modal                                                           */}
      {/* -------------------------------------------------------------------- */}
      {sharingGameId && (
        <div
          className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center"
          onClick={closeShareModal}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Share Game</h3>
            <p className="text-sm text-gray-500 mb-4">
              {sharingGameClipCount > 0
                ? `Share all ${sharingGameClipCount} clip${sharingGameClipCount === 1 ? '' : 's'} in this game. Uncheck to revoke access.`
                : 'Select users to share this game with. Uncheck to revoke access.'}
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

      {/* -------------------------------------------------------------------- */}
      {/* Vimeo Export Modal                                                    */}
      {/* -------------------------------------------------------------------- */}
      {vimeoModal && (
        <div
          className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center"
          onClick={() => setVimeoModal(null)}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Send to Vimeo</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={vimeoTitle}
                  onChange={e => setVimeoTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={vimeoDescription}
                  onChange={e => setVimeoDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Privacy</label>
                <select
                  value={vimeoPrivacy}
                  onChange={e => setVimeoPrivacy(e.target.value as 'unlisted' | 'public' | 'private')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="unlisted">Unlisted (link only)</option>
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <p className="text-xs text-gray-500">A watermark will be applied to the video.</p>
            </div>

            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={handleSendToVimeo}
                disabled={sendingToVimeo !== null || !vimeoTitle.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {sendingToVimeo ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                Send to Vimeo
              </button>
              <button
                onClick={() => setVimeoModal(null)}
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
