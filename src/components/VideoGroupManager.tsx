'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Video, NewVideoGroup } from '@/types/football';

interface SelectedVideo {
  video: Video;
  order: number;
}

interface VideoGroupManagerProps {
  gameId: string;
  videos: Video[];
  onGroupCreated?: (groupId: string) => void;
  onClose?: () => void;
}

export default function VideoGroupManager({
  gameId,
  videos,
  onGroupCreated,
  onClose,
}: VideoGroupManagerProps) {
  const [selectedVideos, setSelectedVideos] = useState<SelectedVideo[]>([]);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Toggle video selection
  const handleToggleVideo = (video: Video) => {
    const exists = selectedVideos.find(sv => sv.video.id === video.id);

    if (exists) {
      // Remove from selection
      setSelectedVideos(selectedVideos.filter(sv => sv.video.id !== video.id));
    } else {
      // Add to selection
      setSelectedVideos([
        ...selectedVideos,
        { video, order: selectedVideos.length }
      ]);
    }
  };

  // Move video up in order
  const handleMoveUp = (index: number) => {
    if (index === 0) return;

    const newSelected = [...selectedVideos];
    [newSelected[index - 1], newSelected[index]] = [newSelected[index], newSelected[index - 1]];

    // Update order numbers
    newSelected.forEach((item, idx) => {
      item.order = idx;
    });

    setSelectedVideos(newSelected);
  };

  // Move video down in order
  const handleMoveDown = (index: number) => {
    if (index === selectedVideos.length - 1) return;

    const newSelected = [...selectedVideos];
    [newSelected[index], newSelected[index + 1]] = [newSelected[index + 1], newSelected[index]];

    // Update order numbers
    newSelected.forEach((item, idx) => {
      item.order = idx;
    });

    setSelectedVideos(newSelected);
  };

  // Remove from selection
  const handleRemove = (videoId: string) => {
    const filtered = selectedVideos.filter(sv => sv.video.id !== videoId);

    // Update order numbers
    filtered.forEach((item, idx) => {
      item.order = idx;
    });

    setSelectedVideos(filtered);
  };

  // Create video group
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError('Please enter a group name');
      return;
    }

    if (selectedVideos.length === 0) {
      setError('Please select at least one video');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      // Create video group
      const { data: group, error: groupError } = await supabase
        .from('video_groups')
        .insert({
          game_id: gameId,
          name: groupName,
          group_type: 'sequence',
          has_merged_video: false,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add videos to group
      const members = selectedVideos.map((sv, index) => ({
        video_group_id: group.id,
        video_id: sv.video.id,
        sequence_order: index,
        include_audio: true,
        audio_volume: 1.0,
      }));

      const { error: membersError } = await supabase
        .from('video_group_members')
        .insert(members);

      if (membersError) throw membersError;

      // Success
      onGroupCreated?.(group.id);
      onClose?.();
    } catch (err: any) {
      console.error('Error creating video group:', err);
      setError(err.message || 'Failed to create video group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg max-w-4xl mx-auto">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-semibold text-gray-900">Create Video Group</h2>
        <p className="text-gray-600 mt-1">
          Combine multiple videos into a single continuous timeline
        </p>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Group Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Group Name
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g., Full Game, Offensive Plays, etc."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Available Videos */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Available Videos ({videos.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {videos.map((video) => {
                const isSelected = selectedVideos.some(sv => sv.video.id === video.id);

                return (
                  <div
                    key={video.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleToggleVideo(video)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {video.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(video.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="ml-2 flex items-center justify-center w-6 h-6 bg-blue-500 text-white rounded-full text-xs font-medium">
                          ✓
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Videos (in order) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Selected Videos ({selectedVideos.length})
            </h3>

            {selectedVideos.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500 text-sm">
                  Click videos on the left to add them
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedVideos.map((sv, index) => (
                  <div
                    key={sv.video.id}
                    className="p-3 border border-gray-200 rounded-lg bg-white"
                  >
                    <div className="flex items-center gap-3">
                      {/* Order Number */}
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>

                      {/* Video Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {sv.video.name}
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
                          disabled={index === selectedVideos.length - 1}
                          className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleRemove(sv.video.id)}
                          className="p-1 text-red-500 hover:text-red-700"
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
            )}
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
          onClick={handleCreateGroup}
          disabled={creating || selectedVideos.length === 0 || !groupName.trim()}
          className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? 'Creating...' : `Create Group (${selectedVideos.length} videos)`}
        </button>
      </div>
    </div>
  );
}
