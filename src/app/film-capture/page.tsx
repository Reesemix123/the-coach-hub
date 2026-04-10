'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Upload, Trash2, Video, Calendar, Users, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { FilmCaptureWithSport } from '@/types/film-capture';
import { AGE_GROUPS } from '@/types/film-capture';

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
  const [gameDate, setGameDate] = useState('');
  const [opponent, setOpponent] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const fetchCaptures = useCallback(async () => {
    try {
      const res = await fetch(`/api/film-capture${isAdmin ? '?all=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        setCaptures(data.captures ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch captures:', err);
    }
  }, [isAdmin]);

  useEffect(() => {
    async function init() {
      const supabase = createClient();

      // TODO: MULTI-SPORT — Sports query filters to active + internal for film capture
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
        setIsAdmin(profile?.is_platform_admin === true);
      }

      await fetchCaptures();
      setLoading(false);
    }
    init();
    // fetchCaptures is stable after isAdmin is resolved; init runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    // Grab values from state, falling back to DOM inputs (Safari may not trigger onChange on restore)
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
    setUploadProgress('Uploading...');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('sport_id', effectiveSportId);
      formData.append('game_date', effectiveGameDate);
      if (opponent.trim()) formData.append('opponent', opponent.trim());
      if (ageGroup) formData.append('age_group', ageGroup);

      const res = await fetch('/api/film-capture/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccess('Film uploaded successfully');
      setFile(null);
      setSportId('');
      setGameDate('');
      setOpponent('');
      setAgeGroup('');
      // Reset file input
      const fileInput = document.getElementById('film-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

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
      }
    } finally {
      setDeletingId(null);
    }
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
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
              {/* TODO: MULTI-SPORT — Sport dropdown populated from sports table */}
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

        {/* Library */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isAdmin ? 'All Uploads' : 'Your Uploads'}
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : captures.length === 0 ? (
            <div className="text-center py-12">
              <Video size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No uploads yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {captures.map(capture => (
                <div key={capture.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Video player */}
                  {capture.playback_url && (
                    <video
                      controls
                      preload="metadata"
                      className="w-full max-h-[400px] bg-black"
                    >
                      <source src={capture.playback_url} type={capture.mime_type || 'video/mp4'} />
                      Your browser does not support video playback.
                    </video>
                  )}

                  {/* Metadata */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{capture.sport_icon || '🎥'}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {capture.sport_name}{capture.opponent ? ` vs ${capture.opponent}` : ''}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {new Date(capture.game_date).toLocaleDateString()}
                            </span>
                            {capture.age_group && (
                              <span className="flex items-center gap-1">
                                <Users size={10} />
                                {capture.age_group}
                              </span>
                            )}
                            <span>{formatFileSize(capture.file_size_bytes)}</span>
                            <span>{capture.file_name}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(capture.id, capture.file_name)}
                        disabled={deletingId === capture.id}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === capture.id
                          ? <Loader2 size={16} className="animate-spin" />
                          : <Trash2 size={16} />
                        }
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
