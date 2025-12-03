'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

interface SessionInfo {
  success: boolean;
  session_id?: string;
  action?: 'created' | 'updated';
  revoked_count?: number;
  session_limit?: number;
  active_count?: number;
}

interface UseSessionTrackingOptions {
  /** Heartbeat interval in milliseconds (default: 5 minutes) */
  heartbeatInterval?: number;
  /** Whether to show notification when sessions are revoked */
  notifyOnRevoke?: boolean;
  /** Callback when session is registered */
  onSessionRegistered?: (info: SessionInfo) => void;
  /** Callback when other sessions are revoked due to limit */
  onSessionsRevoked?: (count: number) => void;
}

/**
 * Hook to track user sessions and enforce device limits
 * Call this in your main layout or auth wrapper component
 */
export function useSessionTracking(options: UseSessionTrackingOptions = {}) {
  const {
    heartbeatInterval = 5 * 60 * 1000, // 5 minutes
    onSessionRegistered,
    onSessionsRevoked,
  } = options;

  const isRegistered = useRef(false);
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);

  // Register session on mount
  const registerSession = useCallback(async () => {
    if (isRegistered.current) return;

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      // Get location info if available (optional)
      let locationData = {};
      try {
        // You could use a geolocation service here
        // For now, we'll let the server handle what it can
      } catch {
        // Location not available, that's fine
      }

      const response = await fetch('/api/user/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(locationData),
      });

      if (response.ok) {
        const data: SessionInfo = await response.json();
        isRegistered.current = true;

        if (onSessionRegistered) {
          onSessionRegistered(data);
        }

        // Notify if sessions were revoked
        if (data.revoked_count && data.revoked_count > 0 && onSessionsRevoked) {
          onSessionsRevoked(data.revoked_count);
        }
      }
    } catch (error) {
      console.error('Failed to register session:', error);
    }
  }, [onSessionRegistered, onSessionsRevoked]);

  // Send heartbeat to update last_active_at
  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch('/api/user/sessions', {
        method: 'PATCH',
      });
    } catch (error) {
      console.error('Failed to send session heartbeat:', error);
    }
  }, []);

  // Setup on mount
  useEffect(() => {
    // Register session
    registerSession();

    // Setup heartbeat
    if (heartbeatInterval > 0) {
      heartbeatTimer.current = setInterval(sendHeartbeat, heartbeatInterval);
    }

    // Cleanup
    return () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
      }
    };
  }, [registerSession, sendHeartbeat, heartbeatInterval]);

  // Re-register on visibility change (tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sendHeartbeat]);

  return {
    registerSession,
    sendHeartbeat,
  };
}

/**
 * Fetch current user's sessions
 */
export async function getUserSessions() {
  const response = await fetch('/api/user/sessions');
  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }
  return response.json();
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string) {
  const response = await fetch(`/api/user/sessions?session_id=${sessionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to revoke session');
  }
  return response.json();
}

/**
 * Revoke all sessions except current
 */
export async function revokeAllOtherSessions() {
  const response = await fetch('/api/user/sessions?revoke_all=true', {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to revoke sessions');
  }
  return response.json();
}
