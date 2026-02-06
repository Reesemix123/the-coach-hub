'use client';

import { useState, useCallback } from 'react';
import { type UseFormReset } from 'react-hook-form';
import { isFieldVisibleForTier, type TaggingTier } from '@/types/football';
import type { SpecialTeamsUnit } from '@/types/football';
import type { AITagPredictions } from '@/components/film/AITaggingButton';
import type { TaggingMode } from '@/components/film/context/types';

// ============================================
// TYPES
// ============================================

export interface UseTaggingFormOptions {
  taggingTier: TaggingTier | null;
  formReset: UseFormReset<any>;
}

export interface UseTaggingFormReturn {
  // Tagging mode
  taggingMode: TaggingMode;
  setTaggingMode: (mode: TaggingMode) => void;
  isTaggingOpponent: boolean;

  // Special teams
  selectedSpecialTeamsUnit: SpecialTeamsUnit | '';
  setSelectedSpecialTeamsUnit: (unit: SpecialTeamsUnit | '') => void;

  // Tackler state
  selectedTacklers: string[];
  primaryTacklerId: string;
  toggleTackler: (playerId: string) => void;
  setPrimaryTackler: (playerId: string) => void;
  setSelectedTacklers: (tacklers: string[]) => void;

  // Drive assignment
  driveAssignMode: 'current' | 'new' | 'select';
  setDriveAssignMode: (mode: 'current' | 'new' | 'select') => void;

  // Auto-population
  autoPopulatedFields: string[];
  setAutoPopulatedFields: (fields: string[]) => void;
  getFieldClassName: (fieldName: string, baseClass: string) => string;
  handleFieldChange: (fieldName: string) => void;

  // AI state
  aiPredictions: AITagPredictions | null;
  setAiPredictions: (predictions: AITagPredictions | null) => void;
  aiFilledFields: Record<string, number>;
  setAiFilledFields: (fields: Record<string, number>) => void;
  aiError: string | null;
  setAiError: (error: string | null) => void;
  getAIConfidenceClass: (fieldName: string) => string;

  // Helpers
  isFieldVisible: (field: string) => boolean;
  closeModal: () => void;

  // Save guard
  isSavingPlay: boolean;
  setIsSavingPlay: (saving: boolean) => void;
}

// ============================================
// HOOK
// ============================================

export function useTaggingForm({ taggingTier, formReset }: UseTaggingFormOptions): UseTaggingFormReturn {
  // Tagging mode
  const [taggingMode, setTaggingMode] = useState<TaggingMode>('offense');
  const [selectedSpecialTeamsUnit, setSelectedSpecialTeamsUnit] = useState<SpecialTeamsUnit | ''>('');

  // Tackler state
  const [selectedTacklers, setSelectedTacklers] = useState<string[]>([]);
  const [primaryTacklerId, setPrimaryTacklerId] = useState<string>('');

  // Drive assignment
  const [driveAssignMode, setDriveAssignMode] = useState<'current' | 'new' | 'select'>('current');

  // Auto-population
  const [autoPopulatedFields, setAutoPopulatedFields] = useState<string[]>([]);

  // AI state
  const [aiPredictions, setAiPredictions] = useState<AITagPredictions | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Record<string, number>>({});
  const [aiError, setAiError] = useState<string | null>(null);

  // Save guard
  const [isSavingPlay, setIsSavingPlay] = useState(false);

  // Derived
  const isTaggingOpponent = taggingMode === 'defense';

  const toggleTackler = useCallback((playerId: string) => {
    setSelectedTacklers(prev => {
      if (prev.includes(playerId)) {
        if (primaryTacklerId === playerId) {
          setPrimaryTacklerId('');
        }
        return prev.filter(id => id !== playerId);
      } else {
        const newSelection = [...prev, playerId];
        if (newSelection.length === 1) {
          setPrimaryTacklerId(playerId);
        }
        return newSelection;
      }
    });
  }, [primaryTacklerId]);

  const getAIConfidenceClass = useCallback((fieldName: string): string => {
    const confidence = aiFilledFields[fieldName];
    if (confidence === undefined) return '';
    if (confidence >= 80) return 'ring-2 ring-green-400 bg-green-50';
    if (confidence >= 60) return 'ring-2 ring-yellow-400 bg-yellow-50';
    return 'ring-2 ring-red-400 bg-red-50';
  }, [aiFilledFields]);

  const isFieldVisible = useCallback((field: string): boolean => {
    if (!taggingTier) return false;
    const unitType = taggingMode === 'specialTeams' ? 'specialTeams' : (taggingMode === 'defense' ? 'defense' : 'offense');
    return isFieldVisibleForTier(field, taggingTier, unitType);
  }, [taggingTier, taggingMode]);

  const getFieldClassName = useCallback((fieldName: string, baseClass: string): string => {
    const isAuto = autoPopulatedFields.includes(fieldName);
    return `${baseClass} ${isAuto ? 'bg-blue-50 border-blue-300' : ''}`;
  }, [autoPopulatedFields]);

  const handleFieldChange = useCallback((fieldName: string) => {
    setAutoPopulatedFields(prev => prev.filter(f => f !== fieldName));
  }, []);

  const closeModal = useCallback(() => {
    setTaggingMode('offense');
    setSelectedSpecialTeamsUnit('');
    setSelectedTacklers([]);
    setPrimaryTacklerId('');
    setAiPredictions(null);
    setAiFilledFields({});
    setAiError(null);
    setAutoPopulatedFields([]);
    setDriveAssignMode('current');
    setIsSavingPlay(false);
    formReset();
  }, [formReset]);

  return {
    taggingMode,
    setTaggingMode,
    isTaggingOpponent,
    selectedSpecialTeamsUnit,
    setSelectedSpecialTeamsUnit,
    selectedTacklers,
    primaryTacklerId,
    toggleTackler,
    setPrimaryTackler: setPrimaryTacklerId,
    setSelectedTacklers,
    driveAssignMode,
    setDriveAssignMode,
    autoPopulatedFields,
    setAutoPopulatedFields,
    getFieldClassName,
    handleFieldChange,
    aiPredictions,
    setAiPredictions,
    aiFilledFields,
    setAiFilledFields,
    aiError,
    setAiError,
    getAIConfidenceClass,
    isFieldVisible,
    closeModal,
    isSavingPlay,
    setIsSavingPlay,
  };
}
