/**
 * Playbook API
 *
 * GET /api/playbook
 * Fetch plays from the playbook for a team
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/playbook
 * Fetch plays with optional field selection
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamId = searchParams.get('teamId');
    const fields = searchParams.get('fields'); // comma-separated field names

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Build select query based on requested fields
    let selectFields = '*';
    if (fields) {
      selectFields = fields.split(',').map(f => f.trim()).join(',');
    }

    // Fetch plays for the team (or team's personal playbook)
    const { data: plays, error } = await supabase
      .from('playbook_plays')
      .select(selectFields)
      .or(`team_id.eq.${teamId},team_id.is.null`)
      .eq('is_archived', false)
      .order('play_code');

    if (error) {
      console.error('Error fetching playbook:', error);
      return NextResponse.json(
        { error: 'Failed to fetch playbook' },
        { status: 500 }
      );
    }

    return NextResponse.json({ plays: plays || [] });
  } catch (error) {
    console.error('Playbook API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch playbook' },
      { status: 500 }
    );
  }
}
