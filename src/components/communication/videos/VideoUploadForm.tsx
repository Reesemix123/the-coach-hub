'use client';

import React, { useState, useRef } from 'react';
import { Upload, Video, Loader2, Check, AlertCircle } from 'lucide-react';
import { NotificationChannelPicker } from '@/components/communication/shared/NotificationChannelPicker';
import type { NotificationChannel, VideoShareType } from '@/types/communication';

interface VideoUploadFormProps {
  teamId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type UploadState = 'idle' | 'creating' | 'uploading' | 'processing' | 'done' | 'error';

export function VideoUploadForm({ teamId, onSuccess, onCancel }: VideoUploadFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coachNotes, setCoachNotes] = useState('');
  const [shareType, setShareType] = useState<VideoShareType>('team');
  const [channel, setChannel] = useState<NotificationChannel>('email');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploadState === 'creating' || uploadState === 'uploading' || uploadState === 'processing';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !selectedFile) {
      setError('Title and video file are required');
      return;
    }

    try {
      setError(null);
      setUploadState('creating');

      // 1. Create upload URL from our API
      const createResponse = await fetch('/api/communication/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          title: title.trim(),
          description: description.trim() || undefined,
          coachNotes: coachNotes.trim() || undefined,
          shareType,
          notificationChannel: channel,
        }),
      });

      if (!createResponse.ok) {
        const data = await createResponse.json() as { needsTopup?: boolean; error?: string };
        if (data.needsTopup) {
          throw new Error(
            'No video credits remaining. Purchase a top-up pack to continue sharing.'
          );
        }
        throw new Error(data.error || 'Failed to create upload');
      }

      const { uploadUrl } = await createResponse.json() as { uploadUrl: string };

      // 2. Upload directly to Mux
      setUploadState('uploading');

      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(selectedFile);
      });

      setUploadState('processing');

      // Wait briefly then call success — Mux webhook will update asset status async
      setTimeout(() => {
        setUploadState('done');
        onSuccess();
      }, 2000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadState('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* File Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Video File</label>
        {!selectedFile ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Click to select a video</p>
            <p className="text-xs text-gray-500 mt-1">MP4, MOV, or WebM</p>
          </button>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Video className="w-8 h-8 text-gray-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1048576).toFixed(1)} MB
              </p>
            </div>
            {!isUploading && (
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Change
              </button>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="e.g., Game Highlights vs. Lions"
          disabled={isUploading}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          placeholder="Brief description of the video..."
          disabled={isUploading}
        />
      </div>

      {/* Coach Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Coach Notes <span className="text-gray-400 font-normal">(optional, visible to parents)</span>
        </label>
        <textarea
          value={coachNotes}
          onChange={(e) => setCoachNotes(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          placeholder="Add context for parents about this video..."
          disabled={isUploading}
        />
      </div>

      {/* Share Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Share Type</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setShareType('team')}
            disabled={isUploading}
            className={`p-3 rounded-lg border text-left transition-all ${
              shareType === 'team'
                ? 'border-gray-900 ring-1 ring-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-sm font-medium text-gray-900">Team Video</p>
            <p className="text-xs text-gray-500 mt-0.5">Shared with all parents</p>
          </button>
          <button
            type="button"
            onClick={() => setShareType('individual')}
            disabled={isUploading}
            className={`p-3 rounded-lg border text-left transition-all ${
              shareType === 'individual'
                ? 'border-gray-900 ring-1 ring-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-sm font-medium text-gray-900">Individual Clip</p>
            <p className="text-xs text-gray-500 mt-0.5">Unlimited, for one player</p>
          </button>
        </div>
      </div>

      {/* Notification Channel */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notify Parents Via
        </label>
        <NotificationChannelPicker value={channel} onChange={setChannel} showLabel={false} />
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {uploadState === 'processing' ? (
              <Check className="w-5 h-5 text-green-500" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
            )}
            <span className="text-sm text-gray-700">
              {uploadState === 'creating' && 'Preparing upload...'}
              {uploadState === 'uploading' && `Uploading... ${uploadProgress}%`}
              {uploadState === 'processing' &&
                'Upload complete! Mux is processing your video...'}
            </span>
          </div>
          {uploadState === 'uploading' && (
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isUploading || !selectedFile || !title.trim()}
          className="flex-1 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium transition-colors disabled:opacity-50"
        >
          Upload Video
        </button>
      </div>
    </form>
  );
}
