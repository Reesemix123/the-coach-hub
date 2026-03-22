/**
 * API: /api/communication/messages/upload
 *
 * POST - Upload a message attachment image to Supabase Storage.
 *
 * Access rules:
 * - Caller must be authenticated.
 * - Accepts multipart/form-data with a single `image` file field.
 * - Validates: MIME type must be jpeg, png, gif, or webp; max 5 MB.
 * - Uploads to the `message-attachments` bucket using the service client
 *   (bypasses Storage RLS so the API route controls access, not bucket policies).
 * - Returns { url: string } — the public URL for use in direct_messages.image_url.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = 'message-attachments';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid multipart form data' },
        { status: 400 }
      );
    }

    const imageField = formData.get('image');
    if (!imageField || !(imageField instanceof File)) {
      return NextResponse.json(
        { error: 'A file field named "image" is required' },
        { status: 400 }
      );
    }

    const file = imageField;

    // 3. Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'File must be a JPEG, PNG, GIF, or WebP image' },
        { status: 400 }
      );
    }

    // 4. Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File size must not exceed 5 MB' },
        { status: 400 }
      );
    }

    // 5. Extract teamId for path namespacing (optional but enforces tenant isolation)
    const teamId = formData.get('teamId');
    if (!teamId || typeof teamId !== 'string') {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // 6. Build a deterministic, collision-resistant storage path
    const timestamp = Date.now();
    // Sanitise the original filename to strip path separators and unusual chars
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${teamId}/${user.id}/${timestamp}-${safeFilename}`;

    // 7. Upload via service client to bypass bucket RLS
    const serviceClient = createServiceClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[messages/upload] Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    // 8. Return the public URL
    const { data: urlData } = serviceClient.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    return NextResponse.json({ url: urlData.publicUrl }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/communication/messages/upload] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
