'use client';

// /admin/system - System Management Dashboard
// Platform admin controls for feature flags, tier config, trial settings, and health

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Flag,
  Layers,
  Clock,
  Activity,
  RefreshCw,
  Plus,
  Trash2,
  Save,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';

// Types
type SystemTab = 'flags' | 'tiers' | 'trial' | 'health';

interface FeatureFlags {
  [key: string]: boolean;
}

interface TierConfig {
  id: string;
  name: string;
  description?: string;
  ai_credits: number;
  price_monthly: number;
  features: string[];
  active_subscriptions: number;
}

interface TrialConfig {
  trial_enabled: boolean;
  trial_duration_days: number;
  trial_allowed_tiers: string[];
  trial_ai_credits_limit: number;
}

interface ServiceStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency_ms?: number;
  error?: string;
  message?: string;
}

interface BackgroundJobStatus {
  last_run: string | null;
  status: 'success' | 'failed' | 'never_run';
  message?: string;
}

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceStatus;
    email: ServiceStatus;
    stripe: ServiceStatus;
    ai_provider: ServiceStatus;
  };
  background_jobs: {
    subscription_sync: BackgroundJobStatus;
    credit_reset: BackgroundJobStatus;
    invoice_generation: BackgroundJobStatus;
  };
}

// Tab Button Component
function TabButton({
  label,
  icon: Icon,
  active,
  onClick
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-gray-900 text-white'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// Toggle Switch Component
function Toggle({
  checked,
  onChange,
  disabled = false
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-gray-900' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// Feature Flags View
function FeatureFlagsView() {
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newFlagName, setNewFlagName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system/feature-flags');
      if (!res.ok) throw new Error('Failed to fetch feature flags');
      const data = await res.json();
      setFlags(data.flags || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = async (flag: string, enabled: boolean) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system/feature-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag, enabled })
      });
      if (!res.ok) throw new Error('Failed to update flag');
      setFlags(prev => ({ ...prev, [flag]: enabled }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFlag = async () => {
    if (!newFlagName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag: newFlagName.toLowerCase().replace(/\s+/g, '_'), enabled: false })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add flag');
      }
      const data = await res.json();
      setFlags(data.flags);
      setNewFlagName('');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add flag');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFlag = async (flag: string) => {
    if (!confirm(`Delete feature flag "${flag}"?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system/feature-flags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag })
      });
      if (!res.ok) throw new Error('Failed to delete flag');
      setFlags(prev => {
        const { [flag]: removed, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Feature Flags</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" />
            Add Flag
          </button>
        </div>

        {showAddForm && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFlagName}
                onChange={(e) => setNewFlagName(e.target.value)}
                placeholder="flag_name (lowercase, underscores)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                onClick={handleAddFlag}
                disabled={saving || !newFlagName.trim()}
                className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewFlagName(''); }}
                className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {Object.keys(flags).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No feature flags configured. Click "Add Flag" to create one.
            </div>
          ) : (
            Object.entries(flags).map(([flag, enabled]) => (
              <div key={flag} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{flag}</p>
                  <p className="text-sm text-gray-500">{enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle
                    checked={enabled}
                    onChange={(checked) => handleToggle(flag, checked)}
                    disabled={saving}
                  />
                  <button
                    onClick={() => handleDeleteFlag(flag)}
                    className="p-2 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Tier Config View
function TierConfigView() {
  const [tiers, setTiers] = useState<TierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TierConfig>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTiers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system/tiers');
      if (!res.ok) throw new Error('Failed to fetch tiers');
      const data = await res.json();
      setTiers(data.tiers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  const handleEdit = (tier: TierConfig) => {
    setEditingTier(tier.id);
    setEditForm(tier);
  };

  const handleSave = async () => {
    if (!editingTier) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system/tiers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId: editingTier,
          name: editForm.name,
          description: editForm.description,
          ai_credits: editForm.ai_credits,
          price_monthly: editForm.price_monthly,
          features: editForm.features
        })
      });
      if (!res.ok) throw new Error('Failed to update tier');
      await fetchTiers();
      setEditingTier(null);
      setEditForm({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
        Note: Price changes only affect new subscriptions, not existing ones.
      </div>

      <div className="grid gap-4">
        {tiers.map((tier) => (
          <div key={tier.id} className="bg-white rounded-xl border border-gray-200 p-4">
            {editingTier === tier.id ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price ($/month)</label>
                    <input
                      type="number"
                      value={editForm.price_monthly || 0}
                      onChange={(e) => setEditForm({ ...editForm, price_monthly: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">AI Credits</label>
                    <input
                      type="number"
                      value={editForm.ai_credits || 0}
                      onChange={(e) => setEditForm({ ...editForm, ai_credits: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Features (comma-separated)</label>
                    <input
                      type="text"
                      value={(editForm.features || []).join(', ')}
                      onChange={(e) => setEditForm({ ...editForm, features: e.target.value.split(',').map(f => f.trim()).filter(Boolean) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setEditingTier(null); setEditForm({}); }}
                    className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{tier.name}</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tier.id}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{tier.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-gray-600">${tier.price_monthly}/mo</span>
                    <span className="text-gray-600">{tier.ai_credits} AI credits</span>
                    <span className="text-gray-500">{tier.active_subscriptions} active subs</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tier.features.map((feature) => (
                      <span key={feature} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleEdit(tier)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Trial Settings View
function TrialSettingsView() {
  const [config, setConfig] = useState<TrialConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const allTiers = ['little_league', 'hs_basic', 'hs_advanced', 'ai_powered'];

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system/trial-config');
      if (!res.ok) throw new Error('Failed to fetch trial config');
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleChange = (field: keyof TrialConfig, value: unknown) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
    setHasChanges(true);
  };

  const handleTierToggle = (tier: string) => {
    if (!config) return;
    const current = config.trial_allowed_tiers || [];
    const updated = current.includes(tier)
      ? current.filter(t => t !== tier)
      : [...current, tier];
    handleChange('trial_allowed_tiers', updated);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system/trial-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error('Failed to save trial config');
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (!config) {
    return <div className="text-center text-gray-500 py-8">Failed to load trial configuration</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Enable Trials</h3>
            <p className="text-sm text-gray-500">Allow new users to start a free trial</p>
          </div>
          <Toggle
            checked={config.trial_enabled}
            onChange={(checked) => handleChange('trial_enabled', checked)}
          />
        </div>

        <div className="border-t border-gray-200 pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Trial Duration (days)</label>
          <input
            type="number"
            value={config.trial_duration_days}
            onChange={(e) => handleChange('trial_duration_days', parseInt(e.target.value) || 14)}
            min={1}
            max={90}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
          />
        </div>

        <div className="border-t border-gray-200 pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">AI Credits Limit</label>
          <input
            type="number"
            value={config.trial_ai_credits_limit}
            onChange={(e) => handleChange('trial_ai_credits_limit', parseInt(e.target.value) || 0)}
            min={0}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
          />
          <p className="text-sm text-gray-500 mt-1">Maximum AI credits allowed during trial</p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Tiers for Trial</label>
          <div className="space-y-2">
            {allTiers.map((tier) => (
              <label key={tier} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.trial_allowed_tiers.includes(tier)}
                  onChange={() => handleTierToggle(tier)}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-700">{tier.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        {hasChanges && (
          <div className="border-t border-gray-200 pt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// System Health View
function SystemHealthView() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system/health');
      if (!res.ok) throw new Error('Failed to fetch health status');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const statusColors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    unhealthy: 'bg-red-500'
  };

  const jobStatusColors = {
    success: 'bg-green-500',
    failed: 'bg-red-500',
    never_run: 'bg-gray-400'
  };

  if (loading) {
    return <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (error || !health) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
        {error || 'Failed to load health status'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-4 h-4 rounded-full ${statusColors[health.status]}`} />
            <div>
              <h3 className="font-semibold text-gray-900 capitalize">{health.status}</h3>
              <p className="text-sm text-gray-500">Last checked: {new Date(health.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <button
            onClick={fetchHealth}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Services */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Services</h3>
        <div className="space-y-3">
          {Object.entries(health.services).map(([service, status]) => (
            <div key={service} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${statusColors[status.status]}`} />
                <span className="text-gray-900 capitalize">{service.replace('_', ' ')}</span>
              </div>
              <div className="text-sm text-gray-500">
                {status.latency_ms !== undefined && status.status === 'healthy' ? (
                  <span>{status.latency_ms}ms</span>
                ) : status.message ? (
                  <span className="text-gray-400">{status.message}</span>
                ) : status.error ? (
                  <span className="text-red-500">{status.error}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Background Jobs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Background Jobs</h3>
        <div className="space-y-3">
          {Object.entries(health.background_jobs).map(([job, info]) => (
            <div key={job} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${jobStatusColors[info.status]}`} />
                <span className="text-gray-900 capitalize">{job.replace(/_/g, ' ')}</span>
              </div>
              <div className="text-sm text-gray-500">
                {info.status === 'never_run' ? (
                  <span>Never run</span>
                ) : (
                  <span>Last run: {formatRelativeTime(info.last_run)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function AdminSystemPage() {
  const [activeTab, setActiveTab] = useState<SystemTab>('flags');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 rounded-lg">
          <Settings className="w-6 h-6 text-gray-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">System Management</h1>
          <p className="text-sm text-gray-500">Configure platform settings and monitor health</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <TabButton
          label="Feature Flags"
          icon={Flag}
          active={activeTab === 'flags'}
          onClick={() => setActiveTab('flags')}
        />
        <TabButton
          label="Tier Config"
          icon={Layers}
          active={activeTab === 'tiers'}
          onClick={() => setActiveTab('tiers')}
        />
        <TabButton
          label="Trial Settings"
          icon={Clock}
          active={activeTab === 'trial'}
          onClick={() => setActiveTab('trial')}
        />
        <TabButton
          label="System Health"
          icon={Activity}
          active={activeTab === 'health'}
          onClick={() => setActiveTab('health')}
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'flags' && <FeatureFlagsView />}
      {activeTab === 'tiers' && <TierConfigView />}
      {activeTab === 'trial' && <TrialSettingsView />}
      {activeTab === 'health' && <SystemHealthView />}
    </div>
  );
}
