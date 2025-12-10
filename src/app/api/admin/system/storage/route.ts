import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';

/**
 * Admin Storage Configuration API
 * Manage storage limits, quotas, and upload settings
 */

interface StorageLimitsConfig {
  max_file_size_bytes: number;
  max_uploads_per_hour: number;
  allowed_mime_types: string[];
  allowed_extensions: string[];
  tier_quotas: Record<string, number>;
  default_quota_bytes: number;
  enforce_quotas: boolean;
  enforce_rate_limits: boolean;
}

/**
 * GET /api/admin/system/storage
 * Get current storage configuration
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return auth.response;

  try {
    const { data: config, error } = await auth.serviceClient
      .from('platform_config')
      .select('*')
      .eq('key', 'storage_limits')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Get storage config error:', error);
      return NextResponse.json(
        { error: 'Failed to get storage configuration' },
        { status: 500 }
      );
    }

    // Default config if not found
    const defaultConfig: StorageLimitsConfig = {
      max_file_size_bytes: 2147483648, // 2GB
      max_uploads_per_hour: 20,
      allowed_mime_types: [
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'video/x-msvideo',
        'video/avi',
        'video/x-m4v',
        'video/mpeg',
      ],
      allowed_extensions: ['.mp4', '.mov', '.webm', '.avi', '.m4v', '.mpeg', '.mpg'],
      tier_quotas: {
        basic: 10737418240,    // 10GB
        plus: 53687091200,     // 50GB
        premium: 214748364800, // 200GB
      },
      default_quota_bytes: 10737418240, // 10GB
      enforce_quotas: true,
      enforce_rate_limits: true,
    };

    const currentConfig = config?.value || defaultConfig;

    // Add formatted values for display
    const formatted = {
      ...currentConfig,
      max_file_size_formatted: formatBytes(currentConfig.max_file_size_bytes),
      default_quota_formatted: formatBytes(currentConfig.default_quota_bytes),
      tier_quotas_formatted: Object.fromEntries(
        Object.entries(currentConfig.tier_quotas).map(([tier, bytes]) => [
          tier,
          formatBytes(bytes as number),
        ])
      ),
    };

    // Get storage usage statistics
    // Note: is_retained column may not exist yet, so we select without it first
    const { data: videos, error: videosError } = await auth.serviceClient
      .from('videos')
      .select('id, file_size, created_at, game_id')
      .not('file_size', 'is', null);

    if (videosError) {
      console.error('Get videos error:', videosError);
    }

    // Calculate storage usage analytics
    // For now, all videos are considered "visible" since is_retained hasn't been implemented
    let storageUsage = {
      total_videos: 0,
      total_storage_bytes: 0,
      total_storage_formatted: '0 B',
      visible_videos: 0, // Videos visible to customers
      visible_storage_bytes: 0,
      visible_storage_formatted: '0 B',
      retained_videos: 0, // Videos kept for model training (not visible to customer)
      retained_storage_bytes: 0,
      retained_storage_formatted: '0 B',
      avg_video_size_bytes: 0,
      avg_video_size_formatted: '0 B',
      avg_visible_age_days: 0, // Average age of visible videos
      avg_total_age_days: 0, // Average age of all videos (including retained)
    };

    if (videos && videos.length > 0) {
      const now = new Date();
      let totalSize = 0;
      let totalAgeDays = 0;

      for (const video of videos) {
        const fileSize = Number(video.file_size) || 0;
        const createdAt = new Date(video.created_at);
        const ageDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        totalSize += fileSize;
        totalAgeDays += ageDays;
      }

      // Currently all videos are visible (is_retained feature not yet implemented)
      storageUsage = {
        total_videos: videos.length,
        total_storage_bytes: totalSize,
        total_storage_formatted: formatBytes(totalSize),
        visible_videos: videos.length, // All visible for now
        visible_storage_bytes: totalSize,
        visible_storage_formatted: formatBytes(totalSize),
        retained_videos: 0, // None retained yet
        retained_storage_bytes: 0,
        retained_storage_formatted: '0 B',
        avg_video_size_bytes: Math.round(totalSize / videos.length),
        avg_video_size_formatted: formatBytes(Math.round(totalSize / videos.length)),
        avg_visible_age_days: Math.round(totalAgeDays / videos.length),
        avg_total_age_days: Math.round(totalAgeDays / videos.length),
      };
    }

    return NextResponse.json({
      config: formatted,
      usage: storageUsage,
      updated_at: config?.updated_at || null,
    });
  } catch (error) {
    console.error('Storage config GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/system/storage
 * Update storage configuration
 */
export async function PUT(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const {
      max_file_size_bytes,
      max_uploads_per_hour,
      tier_quotas,
      default_quota_bytes,
      enforce_quotas,
      enforce_rate_limits,
      allowed_mime_types,
      allowed_extensions,
    } = body;

    // Validate inputs
    if (max_file_size_bytes !== undefined) {
      if (typeof max_file_size_bytes !== 'number' || max_file_size_bytes < 1048576) {
        return NextResponse.json(
          { error: 'max_file_size_bytes must be at least 1MB (1048576 bytes)' },
          { status: 400 }
        );
      }
      if (max_file_size_bytes > 10737418240) {
        return NextResponse.json(
          { error: 'max_file_size_bytes cannot exceed 10GB' },
          { status: 400 }
        );
      }
    }

    if (max_uploads_per_hour !== undefined) {
      if (typeof max_uploads_per_hour !== 'number' || max_uploads_per_hour < 1) {
        return NextResponse.json(
          { error: 'max_uploads_per_hour must be at least 1' },
          { status: 400 }
        );
      }
    }

    if (tier_quotas !== undefined) {
      if (typeof tier_quotas !== 'object') {
        return NextResponse.json(
          { error: 'tier_quotas must be an object' },
          { status: 400 }
        );
      }
      for (const [tier, quota] of Object.entries(tier_quotas)) {
        if (typeof quota !== 'number' || quota < 0) {
          return NextResponse.json(
            { error: `Invalid quota for tier ${tier}` },
            { status: 400 }
          );
        }
      }
    }

    // Get current config
    const { data: currentConfig } = await auth.serviceClient
      .from('platform_config')
      .select('value')
      .eq('key', 'storage_limits')
      .single();

    // Merge with updates
    const updatedConfig = {
      ...(currentConfig?.value || {}),
      ...(max_file_size_bytes !== undefined && { max_file_size_bytes }),
      ...(max_uploads_per_hour !== undefined && { max_uploads_per_hour }),
      ...(tier_quotas !== undefined && {
        tier_quotas: { ...(currentConfig?.value?.tier_quotas || {}), ...tier_quotas },
      }),
      ...(default_quota_bytes !== undefined && { default_quota_bytes }),
      ...(enforce_quotas !== undefined && { enforce_quotas }),
      ...(enforce_rate_limits !== undefined && { enforce_rate_limits }),
      ...(allowed_mime_types !== undefined && { allowed_mime_types }),
      ...(allowed_extensions !== undefined && { allowed_extensions }),
    };

    // Upsert config
    const { error: upsertError } = await auth.serviceClient
      .from('platform_config')
      .upsert({
        key: 'storage_limits',
        value: updatedConfig,
        description: 'Video storage limits. Configurable quotas per tier, file size limits, and rate limiting.',
        updated_at: new Date().toISOString(),
        updated_by: auth.admin.id,
      });

    if (upsertError) {
      console.error('Update storage config error:', upsertError);
      return NextResponse.json(
        { error: 'Failed to update storage configuration' },
        { status: 500 }
      );
    }

    // Log the change
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'storage_config.updated',
      'config',
      'storage_limits',
      undefined,
      {
        previous: currentConfig?.value || null,
        updated: updatedConfig,
      }
    );

    return NextResponse.json({
      success: true,
      config: updatedConfig,
    });
  } catch (error) {
    console.error('Storage config PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
