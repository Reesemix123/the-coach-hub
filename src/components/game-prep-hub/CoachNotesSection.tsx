'use client';

import { useState, useCallback } from 'react';
import { Shield, Swords, Zap, FileText, Save } from 'lucide-react';
import { updatePrepPlanNotes } from '@/lib/services/game-prep-hub.client';
import debounce from '@/lib/utils/debounce';

type NotesCategory = 'general' | 'offensive' | 'defensive' | 'special_teams';

interface CoachNotesSectionProps {
  prepPlanId: string;
  notes: {
    general: string;
    offensive: string;
    defensive: string;
    special_teams: string;
  };
  onNotesUpdate: (category: NotesCategory, value: string) => void;
}

export default function CoachNotesSection({
  prepPlanId,
  notes,
  onNotesUpdate
}: CoachNotesSectionProps) {
  const [activeTab, setActiveTab] = useState<NotesCategory>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (category: NotesCategory, value: string) => {
      setIsSaving(true);
      try {
        await updatePrepPlanNotes(prepPlanId, category, value);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Failed to save notes:', error);
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    [prepPlanId]
  );

  const handleNotesChange = (category: NotesCategory, value: string) => {
    onNotesUpdate(category, value);
    debouncedSave(category, value);
  };

  const tabs: { id: NotesCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <FileText className="w-4 h-4" /> },
    { id: 'offensive', label: 'Offense', icon: <Swords className="w-4 h-4" /> },
    { id: 'defensive', label: 'Defense', icon: <Shield className="w-4 h-4" /> },
    { id: 'special_teams', label: 'Special Teams', icon: <Zap className="w-4 h-4" /> }
  ];

  const getPlaceholder = (category: NotesCategory): string => {
    switch (category) {
      case 'general':
        return 'General game week notes, focus areas, motivational thoughts...';
      case 'offensive':
        return 'Offensive game plan notes, key plays, adjustments...';
      case 'defensive':
        return 'Defensive game plan notes, coverage calls, blitz packages...';
      case 'special_teams':
        return 'Special teams notes, kickoff/punt strategies, trick plays...';
      default:
        return 'Add your notes here...';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-gray-900 border-b-2 border-gray-900 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}

        {/* Save indicator */}
        <div className="ml-auto flex items-center gap-2 px-4 text-xs text-gray-400">
          {isSaving ? (
            <>
              <Save className="w-3 h-3 animate-pulse" />
              Saving...
            </>
          ) : lastSaved ? (
            <>
              <Save className="w-3 h-3" />
              Saved
            </>
          ) : null}
        </div>
      </div>

      {/* Notes textarea */}
      <div className="p-4">
        <textarea
          value={notes[activeTab]}
          onChange={(e) => handleNotesChange(activeTab, e.target.value)}
          placeholder={getPlaceholder(activeTab)}
          className="w-full h-48 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
        />
      </div>
    </div>
  );
}
