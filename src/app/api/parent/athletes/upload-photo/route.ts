/**
 * API: POST /api/parent/athletes/upload-photo
 * Uploads an athlete profile photo to Supabase Storage.
 *
 * IMPORTANT: The 'profile-photos' bucket must be created manually in
 * Supabase Dashboard with public read access before this route works.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

const BUCKET = 'profile-photos';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify parent
    const serviceClient = createServiceClient();
    const { data: parent } = await serviceClient
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!parent) return NextResponse.json({ error: 'Parent profile required' }, { status: 403 });

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const athleteId = formData.get('athleteId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Build storage path
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const storagePath = athleteId
      ? `${parent.id}/${athleteId}/profile.${ext}`
      : `${parent.id}/temp_${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true, // Allow overwriting profile photo
      });

    if (uploadError) {
      console.error('[upload-photo] Storage upload failed:', uploadError);
      return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = serviceClient.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    return NextResponse.json({
      storagePath,
      publicUrl: urlData.publicUrl,
    });
  } catch (error) {
    console.error('[upload-photo] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
