// API Route: Get AI tagging statistics
// GET /api/teams/[teamId]/ai-tagging/stats

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAccuracyByField } from '@/lib/ai/film';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify team access
    const { data: teamAccess } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const { data: teamOwner } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    if (!teamAccess && teamOwner?.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get current month usage
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];

    const { data: usage } = await supabase
      .from('ai_tagging_usage')
      .select('*')
      .eq('team_id', teamId)
      .eq('period_start', periodStart)
      .single();

    // Get prediction counts by status
    const { data: predictionStats } = await supabase
      .from('ai_tag_predictions')
      .select('status, tagging_tier')
      .eq('team_id', teamId);

    // Calculate prediction statistics
    const statusCounts: Record<string, number> = {};
    const tierCounts: Record<string, number> = {};

    for (const p of predictionStats || []) {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      tierCounts[p.tagging_tier] = (tierCounts[p.tagging_tier] || 0) + 1;
    }

    // Get accuracy by field
    const accuracy = await getAccuracyByField(teamId);

    // Get average confidence by tier
    const { data: confidenceData } = await supabase
      .from('ai_tag_predictions')
      .select('tagging_tier, overall_confidence')
      .eq('team_id', teamId)
      .eq('status', 'completed')
      .not('overall_confidence', 'is', null);

    const confidenceByTier: Record<string, { total: number; count: number }> = {};
    for (const p of confidenceData || []) {
      if (!confidenceByTier[p.tagging_tier]) {
        confidenceByTier[p.tagging_tier] = { total: 0, count: 0 };
      }
      confidenceByTier[p.tagging_tier].total += p.overall_confidence;
      confidenceByTier[p.tagging_tier].count += 1;
    }

    const avgConfidenceByTier: Record<string, number> = {};
    for (const [tier, data] of Object.entries(confidenceByTier)) {
      avgConfidenceByTier[tier] = Math.round(data.total / data.count);
    }

    // Get recent predictions for latency trend
    const { data: recentPredictions } = await supabase
      .from('ai_tag_predictions')
      .select('latency_ms, created_at')
      .eq('team_id', teamId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    const avgLatencyMs = recentPredictions?.length
      ? Math.round(
          recentPredictions.reduce((sum, p) => sum + (p.latency_ms || 0), 0) /
            recentPredictions.length
        )
      : 0;

    return NextResponse.json({
      // Current period usage
      currentPeriod: {
        start: usage?.period_start || periodStart,
        end: usage?.period_end || null,
        playsAnalyzed: usage?.plays_analyzed || 0,
        byTier: {
          quick: usage?.quick_tier_count || 0,
          standard: usage?.standard_tier_count || 0,
          comprehensive: usage?.comprehensive_tier_count || 0,
        },
        totalCostUsd: parseFloat(usage?.total_cost_usd || '0'),
        totalCorrections: usage?.total_corrections || 0,
        correctionRate: usage?.correction_rate
          ? Math.round(usage.correction_rate * 100)
          : 0,
      },

      // All-time statistics
      allTime: {
        totalPredictions: predictionStats?.length || 0,
        byStatus: statusCounts,
        byTier: tierCounts,
      },

      // Quality metrics
      quality: {
        accuracyByField: accuracy || {},
        avgConfidenceByTier,
        avgLatencyMs,
      },

      // Cost metrics
      costs: {
        currentPeriodUsd: parseFloat(usage?.total_cost_usd || '0'),
        inputTokens: usage?.total_input_tokens || 0,
        outputTokens: usage?.total_output_tokens || 0,
      },
    });
  } catch (error) {
    console.error('AI tagging stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
