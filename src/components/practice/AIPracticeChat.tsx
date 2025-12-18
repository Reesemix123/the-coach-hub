'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  X,
  Sparkles,
  Loader2,
  Clock,
  RefreshCw,
  Check,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Users,
  Shield,
  Zap,
  MapPin,
  Calendar,
  Target,
  Crosshair,
} from 'lucide-react';
import type { GeneratedPracticePlan } from '@/lib/ai/practice/practice-plan-generator';
import type { TeamAnalysis } from '@/lib/ai/practice/practice-plan-generator';

type ConversationState =
  | 'loading'
  | 'focus_selection'    // Step 1: Select focus areas
  | 'practice_setup'     // Step 2: Duration, contact level, coach count
  | 'coach_selection'    // Step 3: Select which coaches
  | 'generating'
  | 'preview'
  | 'refining'
  | 'error';

interface SelectedCoach {
  id: string;
  name: string;
  isGuest?: boolean;
}

interface TeamCoach {
  id: string;
  name: string;
  role: 'owner' | 'coach';
}

interface UpcomingGame {
  id: string;
  name: string;
  date: string;
  opponent: string;
}

type ContactLevel = 'no_contact' | 'thud' | 'live';
type FocusCategory = 'offense' | 'defense' | 'special_teams' | 'game_prep';

// Focus area options organized by category
const FOCUS_OPTIONS: Record<FocusCategory, { label: string; items: string[] }> = {
  offense: {
    label: 'Offense',
    items: [
      'Install new offensive plays',
      'Pass protection',
      'Run blocking',
      'Route running',
      'Ball security',
      'QB footwork',
      'QB decision making',
      'Play action',
      'Screen game',
      'Red zone offense',
      '3rd down conversions',
      '2-minute drill',
      'Goal line offense',
    ],
  },
  defense: {
    label: 'Defense',
    items: [
      'Install new defensive plays',
      'Tackling technique',
      'Zone coverage',
      'Man coverage',
      'Pass rush',
      'Pursuit angles',
      'Gap responsibility',
      'Blitz packages',
      'Run fits',
      'Red zone defense',
      'Goal line defense',
      '3rd down defense',
      'Turnover drills',
    ],
  },
  special_teams: {
    label: 'Special Teams',
    items: [
      'Install new special teams plays',
      'Kickoff coverage',
      'Kickoff return',
      'Punt coverage',
      'Punt return',
      'Punt protection',
      'Field goal/PAT',
      'Onside kick',
    ],
  },
  game_prep: {
    label: 'Game Preparation',
    items: [
      'Scout opponent tendencies',
      'Review opponent film',
      'Game plan walkthrough',
      'Situational adjustments',
    ],
  },
};

interface AIPracticeChatProps {
  teamId: string;
  isOpen: boolean;
  onClose: () => void;
  onPlanCreated?: (planId: string) => void;
}

export function AIPracticeChat({
  teamId,
  isOpen,
  onClose,
  onPlanCreated,
}: AIPracticeChatProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  // State
  const [state, setState] = useState<ConversationState>('loading');
  const [analysis, setAnalysis] = useState<TeamAnalysis | null>(null);

  // Focus selection
  const [expandedCategories, setExpandedCategories] = useState<FocusCategory[]>(['offense']);
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);

  // Practice setup
  const [duration, setDuration] = useState(90);
  const [contactLevel, setContactLevel] = useState<ContactLevel>('thud');
  const [coachCount, setCoachCount] = useState(2);

  // Coach selection
  const [teamCoaches, setTeamCoaches] = useState<TeamCoach[]>([]);
  const [selectedCoaches, setSelectedCoaches] = useState<SelectedCoach[]>([]);
  const [guestCoachName, setGuestCoachName] = useState('');
  const [loadingCoaches, setLoadingCoaches] = useState(false);

  // Practice details
  const [practiceDate, setPracticeDate] = useState(new Date().toISOString().split('T')[0]);
  const [practiceLocation, setPracticeLocation] = useState('');
  const [equipmentNeeded, setEquipmentNeeded] = useState<string[]>([]);

  // Generated plan
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPracticePlan | null>(null);
  const [refinementCount, setRefinementCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  // AI-recommended focus areas (derived from analysis)
  const [recommendedFocus, setRecommendedFocus] = useState<string[]>([]);

  // Upcoming games (for game prep recommendations)
  const [upcomingGames, setUpcomingGames] = useState<UpcomingGame[]>([]);
  const [nextGameWithin2Weeks, setNextGameWithin2Weeks] = useState<UpcomingGame | null>(null);

  // Generation progress
  const [generationProgress, setGenerationProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Play code to name mapping (fetched with analysis)
  const [playNameMap, setPlayNameMap] = useState<Record<string, string>>({});

  // Humorous loading messages for coaches
  const LOADING_MESSAGES = [
    "Drawing up plays on the whiteboard...",
    "Consulting the coaching tree...",
    "Making sure the water bottles are full...",
    "Reviewing game film in fast forward...",
    "Calculating optimal whistle usage...",
    "Sharpening the playbook pencils...",
    "Deciding which drill to name after ourselves...",
    "Checking if the tackling dummies are ready...",
    "Coordinating clipboard assignments...",
    "Making sure we have enough cones...",
    "Rehearsing motivational speeches...",
    "Timing the perfect huddle clap...",
    "Organizing the equipment shed (just kidding)...",
    "Finalizing the practice plan...",
  ];

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.dispatchEvent(new Event('practice-builder-open'));
    } else {
      document.body.style.overflow = '';
      window.dispatchEvent(new Event('practice-builder-close'));
    }
    return () => {
      document.body.style.overflow = '';
      window.dispatchEvent(new Event('practice-builder-close'));
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Initialize when opened
  useEffect(() => {
    if (isOpen) {
      initializeChat();
    } else {
      resetState();
    }
  }, [isOpen, teamId]);

  // Animate progress bar and rotate messages during generation
  useEffect(() => {
    if (state !== 'generating') {
      setGenerationProgress(0);
      return;
    }

    // Start with first message
    setLoadingMessage(LOADING_MESSAGES[0]);
    setGenerationProgress(0);

    // Progress animation - takes ~45 seconds to reach 95%
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 95) return 95; // Cap at 95% until complete
        // Slow down as we approach 95%
        const increment = prev < 50 ? 3 : prev < 80 ? 2 : 0.5;
        return Math.min(95, prev + increment);
      });
    }, 1000);

    // Rotate messages every 3.5 seconds
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[messageIndex]);
    }, 3500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [state]);

  function resetState() {
    setState('loading');
    setExpandedCategories(['offense']);
    setSelectedFocus([]);
    setDuration(90);
    setContactLevel('thud');
    setCoachCount(2);
    setTeamCoaches([]);
    setSelectedCoaches([]);
    setGuestCoachName('');
    setPracticeDate(new Date().toISOString().split('T')[0]);
    setPracticeLocation('');
    setEquipmentNeeded([]);
    setGeneratedPlan(null);
    setRefinementCount(0);
    setError(null);
    setRecommendedFocus([]);
    setUpcomingGames([]);
    setNextGameWithin2Weeks(null);
    setGenerationProgress(0);
    setLoadingMessage('');
    setPlayNameMap({});
  }

  // Check if a game is within the next 2 weeks
  function getGameWithin2Weeks(games: UpcomingGame[]): UpcomingGame | null {
    if (!games || games.length === 0) return null;

    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const game of games) {
      const gameDate = new Date(game.date);
      gameDate.setHours(0, 0, 0, 0);

      if (gameDate >= today && gameDate <= twoWeeksFromNow) {
        return game;
      }
    }

    return null;
  }

  async function initializeChat() {
    setState('loading');
    setError(null);

    try {
      // Fetch analysis and play names in parallel
      const [analysisResponse, playsResponse] = await Promise.all([
        fetch(`/api/practice/ai-generate?teamId=${teamId}`),
        fetch(`/api/playbook?teamId=${teamId}&fields=play_code,play_name`),
      ]);

      const data = await analysisResponse.json();

      if (!analysisResponse.ok) {
        throw new Error(data.error || 'Failed to load team data');
      }

      // Build play code to name mapping
      if (playsResponse.ok) {
        const playsData = await playsResponse.json();
        const mapping: Record<string, string> = {};
        (playsData.plays || []).forEach((play: { play_code: string; play_name: string }) => {
          if (play.play_code && play.play_name) {
            mapping[play.play_code] = play.play_name;
          }
        });
        setPlayNameMap(mapping);
      }

      setAnalysis(data.analysis);

      // Store upcoming games
      if (data.upcomingGames) {
        setUpcomingGames(data.upcomingGames);
      }

      // Check for upcoming game within 2 weeks
      const upcomingGame = getGameWithin2Weeks(data.upcomingGames || []);
      setNextGameWithin2Weeks(upcomingGame);

      // Extract recommended focus areas from analysis
      const recommended: string[] = [];

      if (data.analysis?.suggestedFocus) {
        const analysisFocus = data.analysis.suggestedFocus
          .filter((f: string) => !f.includes('NaN'))
          .slice(0, 4);
        recommended.push(...analysisFocus);
      }

      // If there's a game within 2 weeks, add game prep recommendations
      if (upcomingGame) {
        recommended.push(`Scout opponent tendencies (vs ${upcomingGame.opponent})`);
        recommended.push('Game plan walkthrough');
      }

      setRecommendedFocus(recommended);

      // Auto-select recommended focus areas that match our options
      const cleanFocus = recommended.filter((f: string) =>
        Object.values(FOCUS_OPTIONS).some(cat =>
          cat.items.some(item => f.toLowerCase().includes(item.toLowerCase()))
        )
      );

      // Also auto-expand game_prep category if game is upcoming
      if (upcomingGame) {
        setExpandedCategories(['offense', 'game_prep']);
      }

      setSelectedFocus(cleanFocus);

      setState('focus_selection');
    } catch (err) {
      console.error('Error initializing chat:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
      setState('error');
    }
  }

  // Replace play codes (P-001, R-011, etc.) with actual play names
  function replacePlayCodesWithNames(text: string): string {
    if (!text || Object.keys(playNameMap).length === 0) return text;

    // Match patterns like P-001, R-011, D-005, etc. (any letter prefix)
    return text.replace(/[A-Z]-\d{3}/g, (match) => {
      const name = playNameMap[match];
      return name ? name : match;
    });
  }

  function toggleCategory(category: FocusCategory) {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }

  function toggleFocus(focus: string) {
    setSelectedFocus(prev =>
      prev.includes(focus)
        ? prev.filter(f => f !== focus)
        : [...prev, focus]
    );
  }

  // Coach selection functions
  async function fetchTeamCoaches() {
    setLoadingCoaches(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/coaches`);
      if (response.ok) {
        const data = await response.json();
        setTeamCoaches(data.coaches || []);
      }
    } catch (err) {
      console.error('Error fetching coaches:', err);
    } finally {
      setLoadingCoaches(false);
    }
  }

  function toggleCoachSelection(coach: TeamCoach) {
    setSelectedCoaches(prev => {
      const isSelected = prev.some(c => c.id === coach.id);
      if (isSelected) {
        return prev.filter(c => c.id !== coach.id);
      }
      // Don't add if we've hit the limit
      const totalSelected = prev.length + (guestCoachName.trim() ? 1 : 0);
      if (totalSelected >= coachCount) {
        return prev;
      }
      return [...prev, { id: coach.id, name: coach.name }];
    });
  }

  function addGuestCoach() {
    if (!guestCoachName.trim()) return;
    const totalSelected = selectedCoaches.length + 1;
    if (totalSelected > coachCount) return;

    setSelectedCoaches(prev => [
      ...prev,
      { id: `guest-${Date.now()}`, name: guestCoachName.trim(), isGuest: true }
    ]);
    setGuestCoachName('');
  }

  function removeCoach(coachId: string) {
    setSelectedCoaches(prev => prev.filter(c => c.id !== coachId));
  }

  function getTotalSelectedCoaches(): number {
    return selectedCoaches.length;
  }

  function isRecommended(focus: string): boolean {
    return recommendedFocus.some(r =>
      r.toLowerCase().includes(focus.toLowerCase()) ||
      focus.toLowerCase().includes(r.toLowerCase().split(' ')[0])
    );
  }

  function handleFocusConfirm() {
    setState('practice_setup');
    // Scroll to top of content area
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function handleSetupConfirm() {
    // After setup, go to coach selection
    setState('coach_selection');
    setSelectedCoaches([]);
    // Scroll to top of content area
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    await fetchTeamCoaches();
  }

  function handleCoachSelectionConfirm() {
    // After coach selection, generate the plan
    generatePracticePlan();
  }

  async function generatePracticePlan() {
    setState('generating');

    try {
      const response = await fetch('/api/practice/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          duration,
          focusAreas: selectedFocus,
          contactLevel,
          coachCount,
          coaches: selectedCoaches,
          practiceDate,
          practiceLocation,
          equipmentNeeded,
          conditioning: { type: 'sprints', duration: 5 },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate plan');
      }

      // Set progress to 100% before showing preview
      setGenerationProgress(100);
      setLoadingMessage("Finalizing the practice plan...");

      // Brief pause to show 100% completion
      await new Promise(resolve => setTimeout(resolve, 500));

      setGeneratedPlan(data.plan);
      setState('preview');
    } catch (err) {
      console.error('Error generating plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
      setState('error');
    }
  }

  async function handleRefinement(feedback: string) {
    if (refinementCount >= 3) return;

    setState('generating');

    try {
      const response = await fetch('/api/practice/ai-generate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          currentPlan: generatedPlan,
          feedback,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refine plan');
      }

      setGeneratedPlan(data.plan);
      setRefinementCount(prev => prev + 1);
      setState('preview');
    } catch (err) {
      console.error('Error refining plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to refine plan');
      setState('error');
    }
  }

  async function handleUsePlan() {
    if (!generatedPlan) return;

    setIsCreatingPlan(true);

    try {
      const response = await fetch('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          plan: generatedPlan,
          date: practiceDate,
          location: practiceLocation,
          coaches: selectedCoaches,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create practice plan');
      }

      setTimeout(() => {
        if (onPlanCreated) {
          onPlanCreated(data.id);
        } else {
          router.push(`/teams/${teamId}/practice/${data.id}/edit`);
        }
      }, 500);
    } catch (err) {
      console.error('Error creating plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to create plan');
      setState('error');
    } finally {
      setIsCreatingPlan(false);
    }
  }

  function handleRegenerate() {
    setGeneratedPlan(null);
    setRefinementCount(0);
    handleSetupConfirm();
  }

  // Get observation summary from analysis
  function getObservationSummary(): string {
    if (!analysis) return '';

    const parts: string[] = [];

    if (analysis.primaryWeakness && !analysis.primaryWeakness.includes('NaN')) {
      const weaknessText = replacePlayCodesWithNames(analysis.primaryWeakness);
      parts.push(`Your team needs work on **${weaknessText}**.`);
    }

    if (analysis.strength && analysis.strength !== 'Analysis unavailable' && !analysis.strength.includes('NaN')) {
      const strengthText = replacePlayCodesWithNames(analysis.strength);
      parts.push(`Strength: ${strengthText}.`);
    }

    if (analysis.secondaryWeakness && !analysis.secondaryWeakness.includes('NaN') && !analysis.secondaryWeakness.match(/^[A-Z]-\d{3}$/)) {
      const secondaryText = replacePlayCodesWithNames(analysis.secondaryWeakness);
      parts.push(`Also consider: ${secondaryText}.`);
    }

    return parts.join(' ');
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-[70] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] md:w-[560px] bg-white shadow-2xl z-[80] transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Practice Builder</h2>
                <p className="text-white/70 text-sm">AI-powered practice planning</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {/* Loading State */}
          {state === 'loading' && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto mb-3" />
                <p className="text-gray-600">Analyzing your team data...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-gray-900 font-medium mb-2">Something went wrong</p>
              <p className="text-gray-500 text-sm mb-4">{error}</p>
              <button
                onClick={initializeChat}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Step 1: Focus Selection */}
          {state === 'focus_selection' && (
            <div className="p-5">
              {/* Upcoming Game Alert */}
              {nextGameWithin2Weeks && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-amber-900 mb-1">Upcoming Game</h3>
                      <p className="text-sm text-amber-800">
                        vs <span className="font-medium">{nextGameWithin2Weeks.opponent}</span> on{' '}
                        {new Date(nextGameWithin2Weeks.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Consider adding Game Preparation focus areas below
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Observations Summary */}
              {analysis && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-emerald-900 mb-1">Team Analysis</h3>
                      <p className="text-sm text-emerald-800">
                        {getObservationSummary() || 'Select your focus areas for this practice.'}
                      </p>
                      {recommendedFocus.length > 0 && (
                        <p className="text-xs text-emerald-600 mt-2">
                          <span className="font-medium">Recommended:</span> {recommendedFocus.slice(0, 3).map(r => r.split(' (')[0]).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Focus Area Selection */}
              <h3 className="font-semibold text-gray-900 mb-3">What do you want to work on?</h3>

              <div className="space-y-2">
                {(Object.keys(FOCUS_OPTIONS) as FocusCategory[]).map((category) => {
                  const { label, items } = FOCUS_OPTIONS[category];
                  const isExpanded = expandedCategories.includes(category);
                  const selectedCount = items.filter(item => selectedFocus.includes(item)).length;
                  const hasRecommended = items.some(item => isRecommended(item));

                  const Icon = category === 'offense' ? Zap : category === 'defense' ? Shield : category === 'game_prep' ? Crosshair : Target;

                  return (
                    <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                          isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${hasRecommended ? 'text-emerald-600' : 'text-gray-400'}`} />
                          <span className="font-medium text-gray-900">{label}</span>
                          {selectedCount > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                              {selectedCount} selected
                            </span>
                          )}
                          {hasRecommended && selectedCount === 0 && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Category Items */}
                      {isExpanded && (
                        <div className="px-4 py-3 border-t border-gray-100 bg-white">
                          <div className="flex flex-wrap gap-2">
                            {items.map((item) => {
                              const isSelected = selectedFocus.includes(item);
                              const isRec = isRecommended(item);

                              return (
                                <button
                                  key={item}
                                  onClick={() => toggleFocus(item)}
                                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white'
                                      : isRec
                                      ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-100'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {item}
                                  {isRec && !isSelected && (
                                    <span className="ml-1 text-emerald-500">★</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Selected Summary */}
              {selectedFocus.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">{selectedFocus.length} focus area{selectedFocus.length !== 1 ? 's' : ''}:</span>{' '}
                    {selectedFocus.join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Practice Setup */}
          {state === 'practice_setup' && (
            <div className="p-5 space-y-5">
              <h3 className="font-semibold text-gray-900">Practice Setup</h3>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="h-4 w-4 inline mr-1.5" />
                  Duration
                </label>
                <div className="flex gap-2">
                  {[60, 90, 120].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        duration === d
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Shield className="h-4 w-4 inline mr-1.5" />
                  Contact Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'no_contact', label: 'No Contact', desc: 'Walk-through' },
                    { value: 'thud', label: 'Thud', desc: 'Controlled' },
                    { value: 'live', label: 'Live', desc: 'Full contact' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setContactLevel(option.value as ContactLevel)}
                      className={`p-3 rounded-lg text-center transition-colors ${
                        contactLevel === option.value
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className="block font-medium text-sm">{option.label}</span>
                      <span className={`block text-xs ${contactLevel === option.value ? 'text-emerald-100' : 'text-gray-500'}`}>
                        {option.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Coach Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="h-4 w-4 inline mr-1.5" />
                  Coaches Available
                </label>
                <p className="text-xs text-gray-500 mb-2">Limits concurrent drill stations</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCoachCount(c)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        coachCount === c
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-1.5" />
                  Practice Date
                </label>
                <input
                  type="date"
                  value={practiceDate}
                  onChange={(e) => setPracticeDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="h-4 w-4 inline mr-1.5" />
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={practiceLocation}
                  onChange={(e) => setPracticeLocation(e.target.value)}
                  placeholder="e.g., Main Field, Gym"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>

              {/* Equipment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Equipment Needed</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {['Cones', 'Blocking Pads', 'Tackling Dummies', 'Sleds', 'Agility Ladders'].map((item) => (
                    <button
                      key={item}
                      onClick={() => setEquipmentNeeded(prev =>
                        prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item]
                      )}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        equipmentNeeded.includes(item)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {/* Custom equipment input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add other equipment..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        const value = e.currentTarget.value.trim();
                        if (!equipmentNeeded.includes(value)) {
                          setEquipmentNeeded(prev => [...prev, value]);
                        }
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      if (input?.value.trim()) {
                        const value = input.value.trim();
                        if (!equipmentNeeded.includes(value)) {
                          setEquipmentNeeded(prev => [...prev, value]);
                        }
                        input.value = '';
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
                {/* Show custom equipment items */}
                {equipmentNeeded.filter(item => !['Cones', 'Blocking Pads', 'Tackling Dummies', 'Sleds', 'Agility Ladders'].includes(item)).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {equipmentNeeded
                      .filter(item => !['Cones', 'Blocking Pads', 'Tackling Dummies', 'Sleds', 'Agility Ladders'].includes(item))
                      .map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-full text-sm font-medium"
                        >
                          {item}
                          <button
                            onClick={() => setEquipmentNeeded(prev => prev.filter(e => e !== item))}
                            className="ml-1 hover:bg-emerald-700 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Coach Selection */}
          {state === 'coach_selection' && (
            <div className="p-5 space-y-5">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Select Coaches</h3>
                <p className="text-sm text-gray-500">
                  Choose {coachCount} coach{coachCount !== 1 ? 'es' : ''} for this practice
                </p>
              </div>

              {loadingCoaches ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                </div>
              ) : (
                <>
                  {/* Team Coaches */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Users className="h-4 w-4 inline mr-1.5" />
                      Team Coaches
                    </label>
                    {teamCoaches.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No coaches found for this team</p>
                    ) : (
                      <div className="space-y-2">
                        {teamCoaches.map((coach) => {
                          const isSelected = selectedCoaches.some(c => c.id === coach.id);
                          const canSelect = isSelected || getTotalSelectedCoaches() < coachCount;

                          return (
                            <button
                              key={coach.id}
                              onClick={() => toggleCoachSelection(coach)}
                              disabled={!canSelect && !isSelected}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                                isSelected
                                  ? 'bg-emerald-50 border-emerald-300'
                                  : canSelect
                                  ? 'bg-white border-gray-200 hover:bg-gray-50'
                                  : 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  isSelected ? 'bg-emerald-600' : 'bg-gray-200'
                                }`}>
                                  {isSelected ? (
                                    <Check className="h-4 w-4 text-white" />
                                  ) : (
                                    <span className="text-gray-500 text-sm font-medium">
                                      {coach.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="text-left">
                                  <span className="font-medium text-gray-900">{coach.name}</span>
                                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                                    coach.role === 'owner'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {coach.role === 'owner' ? 'Head Coach' : 'Coach'}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Guest Coach */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add Guest Coach
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      For parent helpers or guest coaches not in the system
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={guestCoachName}
                        onChange={(e) => setGuestCoachName(e.target.value)}
                        placeholder="Enter guest coach name"
                        disabled={getTotalSelectedCoaches() >= coachCount}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addGuestCoach();
                          }
                        }}
                      />
                      <button
                        onClick={addGuestCoach}
                        disabled={!guestCoachName.trim() || getTotalSelectedCoaches() >= coachCount}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Selected Coaches Summary */}
                  {selectedCoaches.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <h4 className="font-medium text-emerald-900 mb-2">
                        Selected ({selectedCoaches.length}/{coachCount})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedCoaches.map((coach) => (
                          <div
                            key={coach.id}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-200 rounded-full"
                          >
                            <span className="text-sm font-medium text-emerald-800">{coach.name}</span>
                            {coach.isGuest && (
                              <span className="text-xs text-emerald-600">(Guest)</span>
                            )}
                            <button
                              onClick={() => removeCoach(coach.id)}
                              className="text-emerald-600 hover:text-emerald-800"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Generating State */}
          {state === 'generating' && (
            <div className="flex items-center justify-center py-16 px-6">
              <div className="w-full max-w-sm">
                {/* App Logo */}
                <div className="text-center mb-6">
                  <Image
                    src="/apple-touch-icon.png"
                    alt="Youth Coach Hub"
                    width={64}
                    height={64}
                    className="rounded-lg mx-auto"
                  />
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-gray-500">Building your plan</span>
                    <span className="text-xs font-medium text-emerald-600">{Math.round(generationProgress)}%</span>
                  </div>
                </div>

                {/* Humorous message */}
                <p className="text-center text-gray-600 text-sm font-medium min-h-[40px]">
                  {loadingMessage || "Drawing up plays on the whiteboard..."}
                </p>
              </div>
            </div>
          )}

          {/* Preview State */}
          {state === 'preview' && generatedPlan && (
            <div className="p-5">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100">
                  <h3 className="font-semibold text-emerald-900">{generatedPlan.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-emerald-700 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {generatedPlan.duration_minutes} min
                    </span>
                    <span>{generatedPlan.periods.length} periods</span>
                  </div>
                </div>

                {/* AI Reasoning */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-sm text-gray-600">{replacePlayCodesWithNames(generatedPlan.ai_reasoning)}</p>
                </div>

                {/* Periods List */}
                <div className="max-h-72 overflow-y-auto">
                  {generatedPlan.periods.map((period, i) => (
                    <div key={i} className="px-4 py-2.5 border-b border-gray-100 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 text-sm">{period.name}</span>
                        <span className="text-gray-500 text-sm">{period.duration_minutes} min</span>
                      </div>
                      {period.notes && (
                        <p className="text-xs text-gray-500 mt-0.5">{period.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Refinement Input */}
              {refinementCount < 3 && (
                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Request changes (e.g., 'Add more OL drills')"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        handleRefinement(e.currentTarget.value.trim());
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <p className="text-xs text-gray-400 mt-1">{3 - refinementCount} refinements remaining</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-5 py-4">
          {state === 'focus_selection' && (
            <button
              onClick={handleFocusConfirm}
              disabled={selectedFocus.length === 0}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {state === 'practice_setup' && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setState('focus_selection');
                  scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                }}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Back
              </button>
              <button
                onClick={handleSetupConfirm}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center justify-center gap-2"
              >
                Select Coaches
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {state === 'coach_selection' && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setState('practice_setup');
                  scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                }}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Back
              </button>
              <button
                onClick={handleCoachSelectionConfirm}
                disabled={selectedCoaches.length !== coachCount}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                Generate Plan
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          )}

          {state === 'preview' && (
            <div className="flex gap-3">
              <button
                onClick={handleRegenerate}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={handleUsePlan}
                disabled={isCreatingPlan}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                {isCreatingPlan ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Use This Plan
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default AIPracticeChat;
