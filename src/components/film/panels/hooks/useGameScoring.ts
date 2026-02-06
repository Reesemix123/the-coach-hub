'use client';

import { useState, type RefObject } from 'react';
import { createClient } from '@/utils/supabase/client';
import { filmSessionService } from '@/lib/services/film-session.service';
import type { TaggingTier, GameScoreBreakdown, FilmAnalysisStatus } from '@/types/football';
import type { ScoreMismatchResult } from '@/lib/services/game-score.service';
import type { useFilmStateBridge } from '@/components/film/context';

// ============================================
// TYPES
// ============================================

export interface DataFetchingRef {
  fetchGame: () => Promise<void>;
  loadQuarterScoresAndMismatch: () => Promise<void>;
}

interface UseGameScoringOptions {
  gameId: string;
  bridge: ReturnType<typeof useFilmStateBridge>;
  dataFetchingRef: RefObject<DataFetchingRef | null>;
  onShowMarkerPanel: () => void;
}

// ============================================
// HOOK
// ============================================

export function useGameScoring({
  gameId,
  bridge,
  dataFetchingRef,
  onShowMarkerPanel,
}: UseGameScoringOptions) {
  const supabase = createClient();
  const { game } = bridge.state.data;

  // State
  const [taggingTier, setTaggingTier] = useState<TaggingTier | null>(null);
  const [showTierSelector, setShowTierSelector] = useState(false);
  const [showTierUpgrade, setShowTierUpgrade] = useState(false);
  const [quarterScores, setQuarterScores] = useState<GameScoreBreakdown | null>(null);
  const [scoreMismatch, setScoreMismatch] = useState<ScoreMismatchResult | null>(null);
  const [filmAnalysisStatus, setFilmAnalysisStatus] = useState<FilmAnalysisStatus>('not_started');
  const [showTaggingCompleteModal, setShowTaggingCompleteModal] = useState(false);
  const [finalScoreInputs, setFinalScoreInputs] = useState<{ teamScore: string; opponentScore: string }>({ teamScore: '', opponentScore: '' });

  // Handlers
  async function handleScoreMismatchResolve(action: 'use_calculated' | 'use_manual' | 'review') {
    if (action === 'review') {
      onShowMarkerPanel();
    } else {
      await dataFetchingRef.current?.loadQuarterScoresAndMismatch();
    }
  }

  async function handleTierSelect(tier: TaggingTier) {
    try {
      const { error } = await supabase
        .from('games')
        .update({ tagging_tier: tier })
        .eq('id', gameId);

      if (error) throw error;

      setTaggingTier(tier);
      setShowTierSelector(false);
      dataFetchingRef.current?.fetchGame();
    } catch (error) {
      console.error('Error setting tagging tier:', error);
      alert('Failed to set tagging tier. Please try again.');
    }
  }

  async function handleTierUpgrade(newTier: TaggingTier) {
    try {
      const { error } = await supabase
        .from('games')
        .update({ tagging_tier: newTier })
        .eq('id', gameId);

      if (error) throw error;

      setTaggingTier(newTier);
      setShowTierUpgrade(false);
      dataFetchingRef.current?.fetchGame();
    } catch (error) {
      console.error('Error upgrading tagging tier:', error);
      alert('Failed to upgrade tagging tier. Please try again.');
    }
  }

  function openCompleteModal() {
    setFinalScoreInputs({
      teamScore: game?.team_score?.toString() ?? '',
      opponentScore: game?.opponent_score?.toString() ?? '',
    });
    setShowTaggingCompleteModal(true);
  }

  function closeCompleteModal() {
    setShowTaggingCompleteModal(false);
  }

  async function handleConfirmComplete() {
    const newStatus = filmAnalysisStatus === 'complete' ? 'in_progress' : 'complete';

    if (newStatus === 'complete') {
      const teamScore = parseInt(finalScoreInputs.teamScore, 10);
      const opponentScore = parseInt(finalScoreInputs.opponentScore, 10);
      await filmSessionService.updateGameScore(gameId, teamScore, opponentScore);

      if (game) {
        bridge.setGame({
          ...game,
          team_score: teamScore,
          opponent_score: opponentScore,
          game_result: teamScore > opponentScore ? 'win' : teamScore < opponentScore ? 'loss' : 'tie'
        });
      }
    }

    await filmSessionService.updateAnalysisStatus(gameId, newStatus);
    setFilmAnalysisStatus(newStatus);
    if (newStatus === 'complete') {
      dataFetchingRef.current?.loadQuarterScoresAndMismatch();
    }
    setShowTaggingCompleteModal(false);
  }

  function dismissScoreMismatch() {
    setScoreMismatch(prev => prev ? { ...prev, mismatch_acknowledged: true } : null);
  }

  return {
    // State
    taggingTier,
    showTierSelector,
    showTierUpgrade,
    quarterScores,
    scoreMismatch,
    filmAnalysisStatus,
    showTaggingCompleteModal,
    finalScoreInputs,
    // Setters (for callbacks from data fetching)
    setTaggingTier,
    setFilmAnalysisStatus,
    setQuarterScores,
    setScoreMismatch,
    setShowTierSelector,
    setFinalScoreInputs,
    // Handlers
    handleScoreMismatchResolve,
    handleTierSelect,
    handleTierUpgrade,
    openCompleteModal,
    closeCompleteModal,
    handleConfirmComplete,
    dismissScoreMismatch,
  };
}
