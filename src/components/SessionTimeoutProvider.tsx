'use client';

/**
 * SessionTimeoutProvider
 *
 * Manages automatic session timeout for authenticated users.
 * - Tracks user activity (mouse moves, key presses, clicks, scrolls)
 * - Shows warning dialog before timeout
 * - Automatically logs out users after inactivity
 * - Fetches timeout duration from platform config (admin-configurable)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { AlertTriangle, Clock } from 'lucide-react';

interface SessionSettings {
  timeout_minutes: number;
  warning_minutes: number;
  enabled: boolean;
}

const DEFAULT_SETTINGS: SessionSettings = {
  timeout_minutes: 180,  // 3 hours
  warning_minutes: 5,
  enabled: true,
};

// Activity events to track
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

// Pages that don't require session timeout (public pages)
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/callback',
  '/auth/auth-code-error',
  '/about',
  '/contact',
  '/pricing',
  '/terms',
  '/privacy',
];

export default function SessionTimeoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // State
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS);
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Refs for timers
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Check if current path is public
  const isPublicPath = PUBLIC_PATHS.some(path => pathname?.startsWith(path));

  // Fetch session settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/config/session-timeout');
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Error fetching session settings:', error);
        // Use defaults on error
      }
    }

    fetchSettings();
  }, []);

  // Check authentication status
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    }

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
      if (event === 'SIGNED_OUT') {
        clearAllTimers();
        setShowWarning(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Handle logout
  const handleLogout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    await supabase.auth.signOut();
    router.push('/auth/login?reason=session_timeout');
  }, [supabase.auth, router, clearAllTimers]);

  // Reset timers on activity
  const resetTimers = useCallback(() => {
    if (!settings.enabled || !isAuthenticated || isPublicPath) {
      return;
    }

    lastActivityRef.current = Date.now();
    clearAllTimers();
    setShowWarning(false);

    const timeoutMs = settings.timeout_minutes * 60 * 1000;
    const warningMs = (settings.timeout_minutes - settings.warning_minutes) * 60 * 1000;

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setTimeRemaining(settings.warning_minutes * 60);

      // Start countdown
      countdownRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warningMs);

    // Set absolute timeout (backup)
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, timeoutMs);

  }, [settings, isAuthenticated, isPublicPath, clearAllTimers, handleLogout]);

  // Set up activity listeners
  useEffect(() => {
    if (!settings.enabled || !isAuthenticated || isPublicPath) {
      clearAllTimers();
      return;
    }

    // Throttle activity tracking
    let lastTracked = 0;
    const THROTTLE_MS = 30000; // Only track once per 30 seconds

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastTracked > THROTTLE_MS) {
        lastTracked = now;
        resetTimers();
      }
    };

    // Add event listeners
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer setup
    resetTimers();

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [settings.enabled, isAuthenticated, isPublicPath, resetTimers, clearAllTimers]);

  // Handle "Stay Logged In" button
  const handleStayLoggedIn = () => {
    setShowWarning(false);
    resetTimers();
  };

  // Format time remaining
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {children}

      {/* Session Timeout Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Session Expiring</h2>
                  <p className="text-sm text-amber-700">Your session is about to end</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center gap-3 px-6 py-4 bg-gray-100 rounded-xl">
                  <Clock className="w-8 h-8 text-gray-600" />
                  <span className="text-4xl font-mono font-bold text-gray-900">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>

              <p className="text-center text-gray-600 mb-6">
                Due to inactivity, you will be automatically logged out.
                Click below to stay logged in.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleStayLoggedIn}
                  className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  Stay Logged In
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Log Out Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
