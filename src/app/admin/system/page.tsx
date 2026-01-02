'use client';

// /admin/system - System Management Dashboard
// Platform admin controls for system health, storage monitoring, and session settings

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Activity,
  RefreshCw,
  Save,
  Check,
  X,
  AlertTriangle,
  HardDrive,
  Clock
} from 'lucide-react';

// Types
type SystemTab = 'health' | 'storage' | 'session';

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

// StorageConfig type removed - no longer editable from admin UI

interface StorageUsage {
  total_videos: number;
  total_storage_bytes: number;
  total_storage_formatted: string;
  visible_videos: number;
  visible_storage_bytes: number;
  visible_storage_formatted: string;
  retained_videos: number;
  retained_storage_bytes: number;
  retained_storage_formatted: string;
  avg_video_size_bytes: number;
  avg_video_size_formatted: string;
  avg_visible_age_days: number;
  avg_total_age_days: number;
  videos_missing_size_data?: number;
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

  const statusDescriptions = {
    healthy: 'All services are operating normally',
    degraded: 'One or more services have issues but the system is still functional',
    unhealthy: 'Critical services are down - system may not work properly'
  };

  const jobStatusColors = {
    success: 'bg-green-500',
    failed: 'bg-red-500',
    never_run: 'bg-gray-400'
  };

  const jobStatusDescriptions = {
    success: 'Job completed successfully on last run',
    failed: 'Job failed on last run - check logs for details',
    never_run: 'Job has not been executed yet'
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
          <div
            className="flex items-center gap-3 cursor-help"
            title={statusDescriptions[health.status]}
          >
            <span className={`w-4 h-4 rounded-full ${statusColors[health.status]}`} />
            <div>
              <h3 className="font-semibold text-gray-900 capitalize">{health.status}</h3>
              <p className="text-sm text-gray-500">Last checked: {new Date(health.timestamp).toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">{statusDescriptions[health.status]}</p>
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
              <div
                className="flex items-center gap-3 cursor-help"
                title={statusDescriptions[status.status]}
              >
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
              <div
                className="flex items-center gap-3 cursor-help"
                title={jobStatusDescriptions[info.status]}
              >
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

// Storage Usage View (read-only analytics)
function StorageSettingsView() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system/storage');
      if (!res.ok) throw new Error('Failed to fetch storage data');
      const data = await res.json();
      setUsage(data.usage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (loading) {
    return <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        {error}
        <button onClick={() => { setError(null); fetchUsage(); }} className="ml-auto text-red-700 hover:text-red-900">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (!usage) {
    return <div className="text-center text-gray-500 py-8">No storage data available</div>;
  }

  return (
    <div className="space-y-4">
      {/* Storage Usage Analytics */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Storage Usage Analytics
          </h3>
          <button
            onClick={fetchUsage}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Total Storage</p>
            <p className="text-xl font-semibold text-gray-900">{usage.total_storage_formatted}</p>
            <p className="text-xs text-gray-400">{usage.total_videos} videos</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Visible to Customers</p>
            <p className="text-xl font-semibold text-gray-900">{usage.visible_storage_formatted}</p>
            <p className="text-xs text-gray-400">{usage.visible_videos} videos</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Retained (Training)</p>
            <p className="text-xl font-semibold text-gray-900">{usage.retained_storage_formatted}</p>
            <p className="text-xs text-gray-400">{usage.retained_videos} videos</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Avg Video Size</p>
            <p className="text-xl font-semibold text-gray-900">{usage.avg_video_size_formatted}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-gray-600">Avg Age (Visible to Customers)</p>
            <p className="font-medium text-gray-900">{usage.avg_visible_age_days} days</p>
          </div>
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-gray-600">Avg Age (All Retained)</p>
            <p className="font-medium text-gray-900">{usage.avg_total_age_days} days</p>
          </div>
        </div>
      </div>

      {usage.videos_missing_size_data && usage.videos_missing_size_data > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-700 text-sm">
          <strong>Note:</strong> {usage.videos_missing_size_data} video{usage.videos_missing_size_data > 1 ? 's' : ''} uploaded before size tracking was enabled.
          Storage totals may be incomplete.
        </div>
      )}

      <p className="text-sm text-gray-500">
        Storage quotas and upload limits are managed through the subscription tier system.
      </p>
    </div>
  );
}

// Session Settings View
function SessionSettingsView() {
  const [settings, setSettings] = useState({
    timeout_minutes: 180,
    warning_minutes: 5,
    enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system/session');
      if (!res.ok) throw new Error('Failed to fetch session settings');
      const data = await res.json();
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (field: string, value: number | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
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

  // Convert minutes to hours for display
  const timeoutHours = settings.timeout_minutes / 60;

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
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Clock className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Session Timeout Settings</h3>
            <p className="text-sm text-gray-500">Configure automatic logout for inactive users</p>
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between py-4 border-b border-gray-100">
          <div>
            <p className="font-medium text-gray-900">Enable Session Timeout</p>
            <p className="text-sm text-gray-500">Automatically log out users after inactivity</p>
          </div>
          <Toggle
            checked={settings.enabled}
            onChange={(checked) => handleChange('enabled', checked)}
          />
        </div>

        {/* Timeout Duration */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Timeout Duration
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="15"
                max="480"
                step="15"
                value={settings.timeout_minutes}
                onChange={(e) => handleChange('timeout_minutes', parseInt(e.target.value))}
                disabled={!settings.enabled}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="15"
                  max="1440"
                  value={settings.timeout_minutes}
                  onChange={(e) => handleChange('timeout_minutes', parseInt(e.target.value) || 180)}
                  disabled={!settings.enabled}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 text-center disabled:opacity-50"
                />
                <span className="text-sm text-gray-500">minutes</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {timeoutHours >= 1
                ? `${timeoutHours.toFixed(1)} hours`
                : `${settings.timeout_minutes} minutes`
              } of inactivity before logout
            </p>
          </div>

          {/* Warning Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Warning Before Logout
            </label>
            <div className="flex items-center gap-4">
              <select
                value={settings.warning_minutes}
                onChange={(e) => handleChange('warning_minutes', parseInt(e.target.value))}
                disabled={!settings.enabled}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 disabled:opacity-50"
              >
                <option value="1">1 minute</option>
                <option value="2">2 minutes</option>
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
              </select>
              <span className="text-sm text-gray-500">before timeout</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Users will see a warning dialog with a countdown
            </p>
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-3">Quick Presets</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '1 hour', minutes: 60 },
              { label: '2 hours', minutes: 120 },
              { label: '3 hours', minutes: 180 },
              { label: '4 hours', minutes: 240 },
              { label: '8 hours', minutes: 480 },
            ].map((preset) => (
              <button
                key={preset.minutes}
                onClick={() => handleChange('timeout_minutes', preset.minutes)}
                disabled={!settings.enabled}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
                  settings.timeout_minutes === preset.minutes
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end">
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
  );
}

// Main Page Component
export default function AdminSystemPage() {
  const [activeTab, setActiveTab] = useState<SystemTab>('health');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 rounded-lg">
          <Settings className="w-6 h-6 text-gray-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">System Management</h1>
          <p className="text-sm text-gray-500">Monitor system health and configure settings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <TabButton
          label="System Health"
          icon={Activity}
          active={activeTab === 'health'}
          onClick={() => setActiveTab('health')}
        />
        <TabButton
          label="Storage"
          icon={HardDrive}
          active={activeTab === 'storage'}
          onClick={() => setActiveTab('storage')}
        />
        <TabButton
          label="Session"
          icon={Clock}
          active={activeTab === 'session'}
          onClick={() => setActiveTab('session')}
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'health' && <SystemHealthView />}
      {activeTab === 'storage' && <StorageSettingsView />}
      {activeTab === 'session' && <SessionSettingsView />}
    </div>
  );
}
