'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Video } from '@/types/football';

interface CombineVideosModalProps {
  gameId: string;
  selectedVideos: Video[];
  onCombined?: (virtualVideoId: string) => void;
  onClose?: () => void;
}

export default function CombineVideosModal({
  gameId,
  selectedVideos: initialVideos,
  onCombined,
  onClose,
}: CombineVideosModalProps) {
  const [orderedVideos, setOrderedVideos] = useState<Video[]>(initialVideos);
  const [combinedName, setCombinedName] = useState(
    initialVideos.length === 2 ? 'Full Game' :
    initialVideos.length >= 3 ? 'Full Game' :
    'Combined Video'
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Move video up in order
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...orderedVideos];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setOrderedVideos(newOrder);
  };

  // Move video down in order
  const handleMoveDown = (index: number) => {
    if (index === orderedVideos.length - 1) return;
    const newOrder = [...orderedVideos];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrderedVideos(newOrder);
  };

  // Remove video from combination
  const handleRemove = (videoId: string) => {
    if (orderedVideos.length <= 1) {
      setError('Must have at least 1 video to combine');
      return;
    }
    setOrderedVideos(orderedVideos.filter(v => v.id !== videoId));
  };

  // Create combined virtual video
  const handleCombine = async () => {
    if (!combinedName.trim()) {
      setError('Please enter a name for the combined video');
      return;
    }

    if (orderedVideos.length === 0) {
      setError('Must select at least 1 video');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      // Step 1: Create video_group (for VirtualVideoPlayer compatibility)
      const { data: videoGroup, error: groupError } = await supabase
        .from('video_groups')
        .insert({
          game_id: gameId,
          name: combinedName,
          group_type: 'sequence',
          has_merged_video: false,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Step 2: Add videos to group as members
      const members = orderedVideos.map((video, index) => ({
        video_group_id: videoGroup.id,
        video_id: video.id,
        sequence_order: index,
        include_audio: true,
        audio_volume: 1.0,
      }));

      const { error: membersError } = await supabase
        .from('video_group_members')
        .insert(members);

      if (membersError) throw membersError;

      // Step 3: Create virtual video entry (for unified video list)
      const { data: virtualVideo, error: videoError } = await supabase
        .from('videos')
        .insert({
          game_id: gameId,
          name: combinedName,
          is_virtual: true,
          source_video_ids: orderedVideos.map(v => v.id),
          video_count: orderedVideos.length,
          virtual_name: combinedName,
          video_group_id: videoGroup.id, // Link to video_group
        })
        .select()
        .single();

      if (videoError) throw videoError;

      // Update the video_group to reference this virtual video (for future use)
      await supabase
        .from('video_groups')
        .update({ merged_video_id: virtualVideo.id })
        .eq('id', videoGroup.id);

      // Return the virtual video ID so film page can select it
      onCombined?.(virtualVideo.id);
      onClose?.();
    } catch (err: any) {
      console.error('Error creating combined video:', err);
      setError(err.message || 'Failed to create combined video');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg max-w-2xl w-full mx-auto shadow-2xl">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-semibold text-gray-900">Combine Videos</h2>
        <p className="text-gray-600 mt-1">
          Create a seamless combined video from {orderedVideos.length} videos
        </p>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Combined Video Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Combined Video Name
          </label>
          <input
            type="text"
            value={combinedName}
            onChange={(e) => setCombinedName(e.target.value)}
            placeholder="e.g., Full Game, First Half, Offensive Plays"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        {/* Video Order */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Video Order ({orderedVideos.length} videos)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Videos will play in this order. Drag to reorder.
          </p>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {orderedVideos.map((video, index) => (
              <div
                key={video.id}
                className="p-3 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Order Number */}
                  <div className="flex-shrink-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>

                  {/* Video Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {video.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(video.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === orderedVideos.length - 1}
                      className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleRemove(video.id)}
                      className="p-1 text-red-500 hover:text-red-700 ml-1"
                      title="Remove"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-gray-200 flex items-center justify-between">
        <button
          onClick={onClose}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Cancel
        </button>

        <button
          onClick={handleCombine}
          disabled={creating || orderedVideos.length === 0 || !combinedName.trim()}
          className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? 'Combining...' : `Combine ${orderedVideos.length} Videos`}
        </button>
      </div>
    </div>
  );
}
