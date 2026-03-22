'use client';

import { useState, useEffect, use } from 'react';
import { Settings, Cookie, MessageSquare, Loader2, Check } from 'lucide-react';

interface CommSettings {
  treats_enabled: boolean;
  max_treat_slots_per_event: number;
  allow_parent_to_parent_messaging: boolean;
}

export default function CommunicationSettingsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const [settings, setSettings] = useState<CommSettings>({
    treats_enabled: false,
    max_treat_slots_per_event: 2,
    allow_parent_to_parent_messaging: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch(`/api/communication/settings?teamId=${teamId}`);
        if (!response.ok) throw new Error('Failed to fetch settings');
        const data = await response.json();
        setSettings({
          treats_enabled: data.settings.treats_enabled ?? false,
          max_treat_slots_per_event: data.settings.max_treat_slots_per_event ?? 2,
          allow_parent_to_parent_messaging: data.settings.allow_parent_to_parent_messaging ?? true,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [teamId]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSaved(false);

      const response = await fetch('/api/communication/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, ...settings }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-200 rounded w-1/3"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Settings className="w-8 h-8 text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Communication Settings</h1>
            <p className="text-gray-600 mt-1">Configure parent communication features</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Team Treats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-amber-50 rounded-lg">
                <Cookie className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Team Treats Sign-up</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Allow parents to sign up to bring treats and snacks to games
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.treats_enabled}
                    onClick={() => setSettings(s => ({ ...s, treats_enabled: !s.treats_enabled }))}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2
                      ${settings.treats_enabled ? 'bg-black' : 'bg-gray-200'}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                        transition duration-200 ease-in-out
                        ${settings.treats_enabled ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>

                {settings.treats_enabled && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max families per game
                    </label>
                    <select
                      value={settings.max_treat_slots_per_event}
                      onChange={(e) => setSettings(s => ({ ...s, max_treat_slots_per_event: parseInt(e.target.value) }))}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                    >
                      {[1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n} {n === 1 ? 'family' : 'families'}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parent-to-Parent Messaging */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-blue-50 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Parent-to-Parent Messaging</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Allow parents to send direct messages to other parents on the team
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.allow_parent_to_parent_messaging}
                    onClick={() => setSettings(s => ({ ...s, allow_parent_to_parent_messaging: !s.allow_parent_to_parent_messaging }))}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2
                      ${settings.allow_parent_to_parent_messaging ? 'bg-black' : 'bg-gray-200'}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                        transition duration-200 ease-in-out
                        ${settings.allow_parent_to_parent_messaging ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-700">
              <Check className="w-4 h-4" />
              Settings saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
