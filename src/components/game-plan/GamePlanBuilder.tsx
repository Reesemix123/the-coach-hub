'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Printer, Shield, Swords, Zap } from 'lucide-react';
import PlaybookBrowser from './PlaybookBrowser';
import SituationAccordion from './SituationAccordion';
import OpponentTendencies from './OpponentTendencies';
import OpponentOffensiveTendencies from './OpponentOffensiveTendencies';
import OpponentSpecialTeamsTendencies from './OpponentSpecialTeamsTendencies';
import PrintPreviewModal from './PrintPreviewModal';
import type {
  Game,
  PlaybookPlay,
  OpponentProfile,
  OpponentOffensiveProfile,
  OpponentSpecialTeamsProfile,
  PlayRelationshipWithDetails,
  SituationalCategoryId,
  PlayTypeCategoryId,
  GamePlanPlayWithDetails
} from '@/types/football';
import type { GamePlanWithPlays, GamePlanSide } from '@/lib/services/game-plan.service';
import { addPlayToSituation, removePlayFromGamePlan, reorderPlays } from '@/lib/services/game-plan.service';
import { projectPlaySuccess, projectDefensivePlaySuccess, projectSpecialTeamsPlaySuccess } from '@/lib/services/opponent-analytics.service';

interface GamePlanBuilderProps {
  teamId: string;
  teamName: string;
  gameId: string;
  game: Game;
  gamePlan: GamePlanWithPlays;
  playbook: PlaybookPlay[];
  opponentDefensiveProfile: OpponentProfile;
  opponentOffensiveProfile: OpponentOffensiveProfile;
  opponentSpecialTeamsProfile: OpponentSpecialTeamsProfile;
  setupCounterRelationships: PlayRelationshipWithDetails[];
}

export default function GamePlanBuilder({
  teamId,
  teamName,
  gameId,
  game,
  gamePlan,
  playbook,
  opponentDefensiveProfile,
  opponentOffensiveProfile,
  opponentSpecialTeamsProfile,
  setupCounterRelationships
}: GamePlanBuilderProps) {
  const router = useRouter();
  const [activeSide, setActiveSide] = useState<GamePlanSide>('offense');
  const [offensivePlaysBySituation, setOffensivePlaysBySituation] = useState(gamePlan.offensivePlaysBySituation);
  const [defensivePlaysBySituation, setDefensivePlaysBySituation] = useState(gamePlan.defensivePlaysBySituation);
  const [specialTeamsPlaysBySituation, setSpecialTeamsPlaysBySituation] = useState(gamePlan.specialTeamsPlaysBySituation);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSituation, setActiveSituation] = useState<SituationalCategoryId | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Get current plays based on active side
  const playsBySituation = activeSide === 'offense'
    ? offensivePlaysBySituation
    : activeSide === 'defense'
    ? defensivePlaysBySituation
    : specialTeamsPlaysBySituation;

  const setPlaysBySituation = activeSide === 'offense'
    ? setOffensivePlaysBySituation
    : activeSide === 'defense'
    ? setDefensivePlaysBySituation
    : setSpecialTeamsPlaysBySituation;

  // Filter playbook by ODK based on active side
  const filteredPlaybook = playbook.filter(play => {
    const odk = play.attributes?.odk?.toLowerCase() || 'offense';
    if (activeSide === 'offense') return odk === 'offense';
    if (activeSide === 'defense') return odk === 'defense';
    return odk === 'specialteams';
  });

  // Calculate match scores for all plays based on active side and active situation
  const playMatchScores = new Map(
    filteredPlaybook.map(play => [
      play.play_code,
      activeSide === 'offense'
        ? projectPlaySuccess(play, opponentDefensiveProfile, activeSituation)
        : activeSide === 'defense'
        ? projectDefensivePlaySuccess(play, opponentOffensiveProfile, activeSituation)
        : projectSpecialTeamsPlaySuccess(play, opponentSpecialTeamsProfile, activeSituation)
    ])
  );

  // Get flat list of plays for current side in game plan for checking if already added
  const gamePlanPlayCodes = new Set(
    Object.values(playsBySituation).flatMap(plays => plays.map(p => p.play_code))
  );

  // Get set of (play_code, situation) combos already in game plan
  const gamePlanPlaySituations = new Set(
    Object.entries(playsBySituation).flatMap(([sit, plays]) =>
      plays.map(p => `${p.play_code}::${sit}`)
    )
  );

  // Helper to add a single play and update UI
  const addSinglePlay = async (
    playCode: string,
    situation: SituationalCategoryId,
    playTypeCategory: PlayTypeCategoryId
  ): Promise<GamePlanPlayWithDetails | null> => {
    // Check if already in this specific situation
    if (gamePlanPlaySituations.has(`${playCode}::${situation}`)) {
      return null; // Already in this situation
    }

    const result = await addPlayToSituation(gamePlan.id, playCode, situation, playTypeCategory, activeSide);

    // Find the play in playbook
    const play = playbook.find(p => p.play_code === playCode);
    if (!play) return null;

    return {
      id: `temp-${Date.now()}-${playCode}`,
      game_plan_id: gamePlan.id,
      play_code: playCode,
      call_number: result.callNumber,
      sort_order: (playsBySituation[situation]?.length || 0) + 1,
      situation,
      play_type_category: playTypeCategory,
      side: activeSide,
      created_at: new Date().toISOString(),
      play
    };
  };

  const handleAddPlay = async (playCode: string, situation: SituationalCategoryId, playTypeCategory: PlayTypeCategoryId) => {
    // Check if already in this specific situation
    if (gamePlanPlaySituations.has(`${playCode}::${situation}`)) {
      alert('This play is already in this situation');
      return;
    }

    setIsSaving(true);
    try {
      const playsToAdd: GamePlanPlayWithDetails[] = [];

      // Add the main play
      const mainPlay = await addSinglePlay(playCode, situation, playTypeCategory);
      if (mainPlay) {
        playsToAdd.push(mainPlay);
      }

      // Find and auto-add counter plays
      const counterRelationships = setupCounterRelationships.filter(
        rel => rel.setup_play_code === playCode
      );

      for (const rel of counterRelationships) {
        // Check if counter is already in the game plan (any situation)
        if (!gamePlanPlayCodes.has(rel.counter_play_code)) {
          const counterPlay = await addSinglePlay(rel.counter_play_code, situation, playTypeCategory);
          if (counterPlay) {
            playsToAdd.push(counterPlay);
          }
        }
      }

      // Update UI with all added plays
      if (playsToAdd.length > 0) {
        setPlaysBySituation(prev => ({
          ...prev,
          [situation]: [...(prev[situation] || []), ...playsToAdd]
        }));
      }
    } catch (error) {
      console.error('Failed to add play:', error);
      alert('Failed to add play. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePlay = async (playCode: string, situation: string) => {
    setIsSaving(true);
    try {
      // Remove from this specific situation only
      await removePlayFromGamePlan(gamePlan.id, playCode, situation as SituationalCategoryId);

      // Optimistically update UI
      setPlaysBySituation(prev => ({
        ...prev,
        [situation]: (prev[situation] || []).filter(p => p.play_code !== playCode)
      }));
    } catch (error) {
      console.error('Failed to remove play:', error);
      alert('Failed to remove play. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReorderPlays = async (situation: string, reorderedPlays: GamePlanPlayWithDetails[]) => {
    // Optimistically update UI first
    setPlaysBySituation(prev => ({
      ...prev,
      [situation]: reorderedPlays
    }));

    // Persist to database
    try {
      const playOrders = reorderedPlays.map((play, index) => ({
        id: play.id,
        sortOrder: index + 1
      }));
      await reorderPlays(gamePlan.id, situation as SituationalCategoryId, playOrders);
    } catch (error) {
      console.error('Failed to reorder plays:', error);
      // Revert on error - refresh the page to get correct state
      router.refresh();
    }
  };

  const handlePrint = () => {
    setShowPrintModal(true);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const offensePlaysCount = Object.values(offensivePlaysBySituation).flat().length;
  const defensePlaysCount = Object.values(defensivePlaysBySituation).flat().length;
  const specialTeamsPlaysCount = Object.values(specialTeamsPlaysBySituation).flat().length;
  const currentSidePlays = activeSide === 'offense'
    ? offensePlaysCount
    : activeSide === 'defense'
    ? defensePlaysCount
    : specialTeamsPlaysCount;

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/teams/${teamId}/game-week?game=${gameId}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Game Plan: vs {game.opponent}
            </h1>
            <p className="text-sm text-gray-600">
              {game.date ? formatDate(game.date) : 'Date TBD'} | {offensePlaysCount} offense, {defensePlaysCount} defense, {specialTeamsPlaysCount} special teams
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Offense/Defense/Special Teams Toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => {
                setActiveSide('offense');
                setActiveSituation(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeSide === 'offense'
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Swords className="w-4 h-4" />
              Offense
              {offensePlaysCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  activeSide === 'offense' ? 'bg-white/20' : 'bg-gray-200'
                }`}>
                  {offensePlaysCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveSide('defense');
                setActiveSituation(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeSide === 'defense'
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Shield className="w-4 h-4" />
              Defense
              {defensePlaysCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  activeSide === 'defense' ? 'bg-white/20' : 'bg-gray-200'
                }`}>
                  {defensePlaysCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveSide('special_teams');
                setActiveSituation(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeSide === 'special_teams'
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Zap className="w-4 h-4" />
              Special Teams
              {specialTeamsPlaysCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  activeSide === 'special_teams' ? 'bg-white/20' : 'bg-gray-200'
                }`}>
                  {specialTeamsPlaysCount}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Wristband
          </button>
        </div>
      </div>

      {/* Main Content - Split Panel Layout */}
      <div className="flex gap-6">
        {/* Left Panel - Playbook Browser */}
        <div className="w-[420px] flex-shrink-0">
          <div className="sticky top-6">
            <PlaybookBrowser
              plays={filteredPlaybook}
              gamePlanPlayCodes={gamePlanPlayCodes}
              playMatchScores={playMatchScores}
              setupCounterRelationships={setupCounterRelationships}
              activeSituation={activeSituation}
              activeSide={activeSide}
              onAddPlay={handleAddPlay}
              onSituationSelect={setActiveSituation}
            />
          </div>
        </div>

        {/* Right Panel - Opponent Tendencies & Game Plan */}
        <div className="flex-1 space-y-6">
          {/* Opponent Tendencies - Show based on active side */}
          {activeSide === 'offense' ? (
            <OpponentTendencies
              opponentProfile={opponentDefensiveProfile}
              opponentName={game.opponent || 'Opponent'}
            />
          ) : activeSide === 'defense' ? (
            <OpponentOffensiveTendencies
              opponentProfile={opponentOffensiveProfile}
              opponentName={game.opponent || 'Opponent'}
            />
          ) : (
            <OpponentSpecialTeamsTendencies
              opponentProfile={opponentSpecialTeamsProfile}
              opponentName={game.opponent || 'Opponent'}
            />
          )}

          {/* Situation Accordion - Game Plan Builder */}
          <SituationAccordion
            playsBySituation={playsBySituation}
            activeSide={activeSide}
            onRemovePlay={handleRemovePlay}
            onReorderPlays={handleReorderPlays}
            setupCounterRelationships={setupCounterRelationships}
            activeSituation={activeSituation}
            onSituationSelect={setActiveSituation}
          />
        </div>
      </div>

      {/* Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        teamName={teamName}
        opponent={game.opponent || 'Opponent'}
        gameDate={game.date ? formatDate(game.date) : 'Date TBD'}
        offensivePlaysBySituation={offensivePlaysBySituation}
        defensivePlaysBySituation={defensivePlaysBySituation}
        specialTeamsPlaysBySituation={specialTeamsPlaysBySituation}
        setupCounterRelationships={setupCounterRelationships}
      />
    </div>
  );
}
