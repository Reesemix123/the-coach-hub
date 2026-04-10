import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { ALLOWED_VIDEO_TYPES, MAX_FILE_SIZE_BYTES } from '@/types/film-capture';

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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sportId = formData.get('sport_id') as string;
    const gameDate = formData.get('game_date') as string;
    const opponent = formData.get('opponent') as string | null;
    const ageGroup = formData.get('age_group') as string | null;

    if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 });
    if (!sportId) return NextResponse.json({ error: 'sport_id is required' }, { status: 400 });
    if (!gameDate) return NextResponse.json({ error: 'game_date is required' }, { status: 400 });

    // Validate file type
    if (!ALLOWED_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_VIDEO_TYPES)[number])) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: mp4, mov, webm, avi, m4v, mpeg` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum: 5GB' }, { status: 400 });
    }

    // TODO: MULTI-SPORT — Validate sport_id exists in sports table
    const { data: sport } = await supabase.from('sports').select('id').eq('id', sportId).single();
    if (!sport) return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });

    // Upload to storage using service client to bypass bucket RLS
    const serviceClient = createServiceClient();
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${timestamp}_${sanitizedName}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await serviceClient.storage
      .from('film_captures')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[film-capture] Storage upload failed:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Insert record
    const { data: capture, error: insertError } = await serviceClient
      .from('film_captures')
      .insert({
        sport_id: sportId,
        game_date: gameDate,
        opponent: opponent?.trim() || null,
        age_group: ageGroup || null,
        storage_path: storagePath,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        uploader_id: user.id,
        uploader_role: uploaderRole,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[film-capture] Insert failed:', insertError);
      // Clean up the uploaded file to avoid orphaned storage objects
      await serviceClient.storage.from('film_captures').remove([storagePath]);
      return NextResponse.json({ error: 'Failed to save capture record' }, { status: 500 });
    }

    return NextResponse.json({ capture }, { status: 201 });
  } catch (error) {
    console.error('[film-capture/upload] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
