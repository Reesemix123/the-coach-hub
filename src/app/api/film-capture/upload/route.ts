/**
 * API: POST /api/film-capture/upload
 * Saves film capture metadata after the client has uploaded the file
 * directly to Supabase Storage. This avoids the Vercel 4.5MB body limit.
 *
 * Body (JSON): { sport_id, game_date, opponent?, age_group?, storage_path, file_name, file_size_bytes, mime_type, game_id?, clip_label?, clip_order? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

interface UploadBody {
  sport_id?: string;
  game_date?: string;
  opponent?: string | null;
  age_group?: string | null;
  storage_path?: string;
  file_name?: string;
  file_size_bytes?: number;
  mime_type?: string;
  game_id?: string;
  clip_label?: string;
  clip_order?: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Determine role and access
    const [{ data: coachProfile }, { data: parentProfile }] = await Promise.all([
      supabase.from('profiles').select('film_capture_access').eq('id', user.id).maybeSingle(),
      supabase.from('parent_profiles').select('film_capture_access').eq('user_id', user.id).maybeSingle(),
    ]);

    const uploaderRole = coachProfile?.film_capture_access
      ? 'coach'
      : parentProfile?.film_capture_access
        ? 'parent'
        : null;

    if (!uploaderRole) {
      return NextResponse.json({ error: 'Film capture access not granted' }, { status: 403 });
    }

    const body: UploadBody = await request.json();
    const { sport_id, game_date, opponent, age_group, storage_path, file_name, file_size_bytes, mime_type, game_id, clip_label, clip_order } = body;

    if (!sport_id) return NextResponse.json({ error: 'sport_id is required' }, { status: 400 });
    if (!game_date) return NextResponse.json({ error: 'game_date is required' }, { status: 400 });
    if (!storage_path) return NextResponse.json({ error: 'storage_path is required' }, { status: 400 });
    if (!file_name) return NextResponse.json({ error: 'file_name is required' }, { status: 400 });

    // TODO: MULTI-SPORT — Validate sport_id exists in sports table
    const { data: sport } = await supabase.from('sports').select('id').eq('id', sport_id).single();
    if (!sport) return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });

    // Verify the storage path belongs to this user (prevent spoofing)
    if (!storage_path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 });
    }

    // Insert metadata record using service client
    const serviceClient = createServiceClient();
    const { data: capture, error: insertError } = await serviceClient
      .from('film_captures')
      .insert({
        sport_id,
        game_date,
        opponent: opponent?.trim() || null,
        age_group: age_group || null,
        storage_path,
        file_name,
        file_size_bytes: file_size_bytes || null,
        mime_type: mime_type || null,
        uploader_id: user.id,
        uploader_role: uploaderRole,
        game_id: game_id || null,
        clip_label: clip_label?.trim() || null,
        clip_order: typeof clip_order === 'number' ? clip_order : 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[film-capture] Insert failed:', insertError);
      // Try to clean up the orphaned storage file
      await serviceClient.storage.from('film_captures').remove([storage_path]);
      return NextResponse.json({ error: 'Failed to save capture record' }, { status: 500 });
    }

    return NextResponse.json({ capture }, { status: 201 });
  } catch (error) {
    console.error('[film-capture/upload] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
