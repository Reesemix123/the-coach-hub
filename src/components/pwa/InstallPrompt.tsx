'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DAYS = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const expiry = parseInt(raw, 10);
  if (isNaN(expiry)) return false;
  return Date.now() < expiry;
}

function setDismissed(): void {
  const expiry = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(DISMISS_KEY, String(expiry));
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari standalone check
  if ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true) {
    return true;
  }
  // Standard display-mode check (Android/Chrome)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  return false;
}

function isIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  return isIOS && isSafari;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PWA Install Prompt — shows a subtle banner encouraging parents to
 * add the app to their home screen.
 *
 * - Android/Chrome: captures beforeinstallprompt event, shows "Install" button
 * - iOS Safari: detects non-standalone mode, shows "How?" with Share instructions
 * - Already installed: never shown
 * - Dismissed: hidden for 30 days via localStorage
 *
 * This is a self-contained client component. The parent layout (server component)
 * renders it as a leaf node without conversion.
 */
export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already installed or previously dismissed — don't show
    if (isStandalone() || isDismissed()) return;

    // iOS Safari detection
    if (isIOSSafari()) {
      setPlatform('ios');
      setShow(true);
      return;
    }

    // Android/Chrome — listen for beforeinstallprompt
    function handlePrompt(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setPlatform('android');
      setShow(true);
    }

    window.addEventListener('beforeinstallprompt', handlePrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed();
    setShow(false);
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    await prompt.prompt();
    const result = await prompt.userChoice;

    if (result.outcome === 'accepted') {
      setShow(false);
    }

    deferredPromptRef.current = null;
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-[calc(60px+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-4 pb-2">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* App icon */}
          <Image
            src="/apple-touch-icon.png"
            alt="Youth Coach Hub"
            width={32}
            height={32}
            className="rounded-lg flex-shrink-0"
          />

          {/* Text */}
          <p className="flex-1 text-sm text-gray-700 leading-snug">
            Add to Home Screen for the best experience
          </p>

          {/* Action button */}
          {platform === 'android' ? (
            <button
              onClick={handleInstall}
              className="flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
              style={{ backgroundColor: '#B8CA6E', color: '#1a1410' }}
            >
              Install
            </button>
          ) : (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowIOSTip(prev => !prev)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
                style={{ backgroundColor: '#B8CA6E', color: '#1a1410' }}
              >
                How?
              </button>

              {/* iOS tooltip */}
              {showIOSTip && (
                <div className="absolute bottom-full right-0 mb-2 w-56 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                  <p className="leading-relaxed">
                    Tap the{' '}
                    <span className="inline-block align-middle">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline">
                        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                    </span>{' '}
                    <strong>Share</strong> button, then tap{' '}
                    <strong>&quot;Add to Home Screen&quot;</strong>
                  </p>
                  <div className="absolute -bottom-1 right-4 w-2 h-2 bg-gray-900 rotate-45" />
                </div>
              )}
            </div>
          )}

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type augmentation for beforeinstallprompt (not in standard lib)
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
