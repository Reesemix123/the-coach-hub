/**
 * API: /api/communication/game-summaries/[id]/generate
 * POST - Generate an AI draft from coach notes and tagged play data.
 *
 * Uses Gemini 2.5 Flash via the Vercel AI SDK. The prompt enforces positive,
 * parent-friendly language — celebrating effort, never assigning blame.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { getGameSummary, updateGameSummary } from '@/lib/services/communication/report.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface PlayerRow {
  first_name: string;
  last_name: string;
  jersey_number: number;
}

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const summary = await getGameSummary(id);
    if (!summary) return NextResponse.json({ error: 'Summary not found' }, { status: 404 });

    // Enrich the prompt with tagged play data when a game_id is linked
    let playDataSection = '';
    if (summary.game_id) {
      const { data: plays } = await supabase
        .from('play_instances')
        .select('play_code, down, distance, yard_line, yards_gained, result, players(first_name, last_name, jersey_number)')
        .eq('game_id', summary.game_id);

      if (plays && plays.length > 0) {
        const totalPlays = plays.length;
        const touchdowns = plays.filter(p => p.result === 'touchdown').length;
        const totalYards = plays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
        const bigPlays = plays.filter(p => (p.yards_gained || 0) >= 15);

        playDataSection = `\n\nGAME STATISTICS:\n- Total plays: ${totalPlays}\n- Total yards: ${totalYards}\n- Touchdowns: ${touchdowns}`;

        if (bigPlays.length > 0) {
          playDataSection += `\n- Big plays (15+ yards): ${bigPlays.length}`;
          bigPlays.forEach(bp => {
            const player = bp.players as unknown as PlayerRow | null;
            if (player) {
              playDataSection += `\n  - ${player.first_name} ${player.last_name} (#${player.jersey_number}): ${bp.yards_gained} yards`;
            }
          });
        }

        // Aggregate per-player stats for the prompt
        const playerStats = new Map<string, { name: string; plays: number; yards: number; tds: number }>();
        plays.forEach(p => {
          const player = p.players as unknown as PlayerRow | null;
          if (player) {
            const name = `${player.first_name} ${player.last_name}`;
            if (!playerStats.has(name)) {
              playerStats.set(name, { name, plays: 0, yards: 0, tds: 0 });
            }
            const stats = playerStats.get(name)!;
            stats.plays++;
            stats.yards += p.yards_gained || 0;
            if (p.result === 'touchdown') stats.tds++;
          }
        });

        if (playerStats.size > 0) {
          playDataSection += '\n\nPLAYER CONTRIBUTIONS:';
          Array.from(playerStats.values())
            .sort((a, b) => b.plays - a.plays)
            .slice(0, 8)
            .forEach(ps => {
              playDataSection += `\n- ${ps.name}: ${ps.plays} plays, ${ps.yards} yards${ps.tds > 0 ? `, ${ps.tds} TD${ps.tds > 1 ? 's' : ''}` : ''}`;
            });
        }
      }
    }

    const prompt = `You are a youth football coach writing a game summary for parents. Write a polished, parent-friendly 150-250 word game summary.

RULES:
- Use positive, encouraging language
- Highlight team effort and individual contributions
- Never blame any player for mistakes
- Frame challenges as learning opportunities
- Include a brief "looking ahead" sentence at the end
- Mention specific players by name when highlighting good plays
- Keep it warm, professional, and celebratory

GAME DETAILS:
- Opponent: ${summary.opponent || 'Unknown'}
- Our Score: ${summary.score_us ?? 'N/A'}
- Their Score: ${summary.score_them ?? 'N/A'}
- Date: ${summary.game_date || 'Recent'}

COACH'S RAW NOTES:
${summary.coach_raw_notes || 'No notes provided'}${playDataSection}

Write the game summary now:`;

    const result = await generateText({
      model: googleAI('gemini-2.5-flash'),
      prompt,
    });

    // Persist the AI draft so the coach can review before publishing
    const updated = await updateGameSummary(id, { aiDraft: result.text });

    return NextResponse.json({ summary: updated, aiDraft: result.text });
  } catch (error) {
    console.error('Error generating AI draft:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate draft' },
      { status: 500 }
    );
  }
}
