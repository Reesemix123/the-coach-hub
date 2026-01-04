'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Play, Pause, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { FeatureDemo } from '@/config/featureDemos';
import { getNextFeature } from '@/config/featureDemos';
import {
  trackFeatureModalClose,
  trackFeatureModalCTAClick,
  trackFeatureModalSecondaryCTAClick,
  trackFeatureVideoEvent,
} from '@/utils/analytics';

interface FeatureDemoModalProps {
  feature: FeatureDemo;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToFeature?: (featureId: string) => void;
  isAuthenticated?: boolean;
}

// Check if a media file exists by attempting to load it
function useMediaExists(src: string | undefined): boolean | null {
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (!src) {
      setExists(false);
      return;
    }

    // For videos, we'll check on load
    // For images, use Image object
    if (src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg')) {
      const img = new Image();
      img.onload = () => setExists(true);
      img.onerror = () => setExists(false);
      img.src = src;
    } else {
      // For videos, assume it might exist - we'll handle errors in the video element
      setExists(null); // null means "unknown, try loading"
    }
  }, [src]);

  return exists;
}

// Placeholder component when no media is available
function MediaPlaceholder({ feature }: { feature: FeatureDemo }) {
  return (
    <div
      className="w-full aspect-video rounded-xl flex flex-col items-center justify-center"
      style={{
        background: 'rgba(32,26,22,.9)',
        border: '1px solid rgba(148,163,184,.16)',
      }}
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{
          background: 'rgba(184,202,110,.12)',
          border: '1px solid rgba(184,202,110,.18)',
        }}
      >
        <Play className="w-8 h-8 text-[#B8CA6E]" />
      </div>
      <p className="text-sm font-bold text-[#F9FAFB]/60">Demo video coming soon</p>
      <p className="text-xs text-[#F9FAFB]/40 mt-1">{feature.title}</p>
    </div>
  );
}

export default function FeatureDemoModal({
  feature,
  isOpen,
  onClose,
  onNavigateToFeature,
  isAuthenticated = false,
}: FeatureDemoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const fallbackImageExists = useMediaExists(feature.media.fallbackImage);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        trackFeatureModalClose(feature.id, 'escape');
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, feature.id]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Focus the close button when modal opens
    closeButtonRef.current?.focus();

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Reset video state when modal opens
  useEffect(() => {
    if (isOpen) {
      setVideoError(false);
      setVideoLoaded(false);
      setIsPlaying(true);
    }
  }, [isOpen]);

  // Handle click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        trackFeatureModalClose(feature.id, 'click_outside');
        onClose();
      }
    },
    [onClose, feature.id]
  );

  // Handle close button click
  const handleCloseClick = useCallback(() => {
    trackFeatureModalClose(feature.id, 'close_button');
    onClose();
  }, [onClose, feature.id]);

  // Toggle video play/pause
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      trackFeatureVideoEvent(feature.id, 'pause');
    } else {
      videoRef.current.play();
      trackFeatureVideoEvent(feature.id, 'play');
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, feature.id]);

  // Handle video events
  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    console.error('[FeatureDemoModal] Video error:', {
      featureId: feature.id,
      error: video.error,
      networkState: video.networkState,
      readyState: video.readyState,
      src: video.currentSrc,
    });
    setVideoError(true);
    trackFeatureVideoEvent(feature.id, 'error');
  }, [feature.id]);

  const handleVideoLoaded = useCallback(() => {
    console.log('[FeatureDemoModal] Video loaded:', {
      featureId: feature.id,
      src: videoRef.current?.currentSrc,
    });
    setVideoLoaded(true);
    // Auto-play on load
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn('[FeatureDemoModal] Autoplay prevented:', err);
        // Autoplay was prevented, that's okay
        setIsPlaying(false);
      });
    }
  }, [feature.id]);

  const handleVideoEnded = useCallback(() => {
    trackFeatureVideoEvent(feature.id, 'ended');
    // Loop is handled by the video element, but we track the event
  }, [feature.id]);

  // Handle CTA click
  const handleCTAClick = useCallback(() => {
    trackFeatureModalCTAClick(feature.id, feature.cta.label);
  }, [feature.id, feature.cta.label]);

  // Handle secondary CTA click
  const handleSecondaryCTAClick = useCallback(() => {
    if (!feature.secondaryCta) return;

    trackFeatureModalSecondaryCTAClick(feature.id, feature.secondaryCta.action);

    if (feature.secondaryCta.action === 'view-features' && onNavigateToFeature) {
      const nextFeature = getNextFeature(feature.id);
      onNavigateToFeature(nextFeature.id);
    } else if (feature.secondaryCta.action === 'close') {
      onClose();
    }
  }, [feature, onNavigateToFeature, onClose]);

  // Determine the CTA href based on auth state
  const ctaHref = isAuthenticated && feature.cta.authHref ? feature.cta.authHref : feature.cta.href;

  // Determine if we should show video, image, or placeholder
  const showVideo = feature.media.video && !videoError;
  const showFallbackImage = !showVideo && fallbackImageExists;
  const showPlaceholder = !showVideo && !showFallbackImage;

  // Debug logging
  useEffect(() => {
    if (isOpen) {
      console.log('[FeatureDemoModal] Rendering modal:', {
        featureId: feature.id,
        videoPath: feature.media.video,
        webmPath: feature.media.webm,
        showVideo,
        videoError,
        videoLoaded,
      });
    }
  }, [isOpen, feature.id, feature.media.video, feature.media.webm, showVideo, videoError, videoLoaded]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(0,0,0,.75)' }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`modal-title-${feature.id}`}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{
          background: 'rgba(26,20,16,.98)',
          border: '1px solid rgba(148,163,184,.16)',
          boxShadow: '0 25px 50px rgba(0,0,0,.5)',
        }}
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          onClick={handleCloseClick}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#B8CA6E]/50"
          style={{
            background: 'rgba(255,255,255,.1)',
          }}
          aria-label="Close modal"
        >
          <X className="w-4 h-4 text-white/80" />
        </button>

        {/* Media section */}
        <div className="relative p-4 pb-0">
          {showVideo && (
            <div className="relative group">
              <video
                ref={videoRef}
                className="w-full aspect-video rounded-xl object-cover"
                muted
                loop
                playsInline
                autoPlay
                onCanPlay={() => {
                  console.log('[FeatureDemoModal] canplay - video ready');
                  setVideoLoaded(true);
                }}
                onError={handleVideoError}
                onEnded={handleVideoEnded}
              >
                {/* MP4 first - Safari/iOS fires onError when WebM fails, breaking fallback */}
                {feature.media.video && (
                  <source src={feature.media.video} type="video/mp4" />
                )}
                {/* WebM for Chrome/Firefox - better compression */}
                {feature.media.webm && (
                  <source src={feature.media.webm} type="video/webm" />
                )}
              </video>

              {/* Play/Pause overlay button - always visible on mobile, hover on desktop */}
              <button
                onClick={togglePlayPause}
                className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-opacity focus:outline-none focus:ring-2 focus:ring-[#B8CA6E]/50 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                style={{ background: 'rgba(0,0,0,.6)' }}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white ml-0.5" />
                )}
              </button>
            </div>
          )}

          {showFallbackImage && (
            <img
              src={feature.media.fallbackImage}
              alt={`${feature.title} demo`}
              className="w-full aspect-video rounded-xl object-cover"
            />
          )}

          {showPlaceholder && <MediaPlaceholder feature={feature} />}
        </div>

        {/* Content section */}
        <div className="p-6">
          <h2
            id={`modal-title-${feature.id}`}
            className="text-xl font-black text-[#F9FAFB] mb-2"
          >
            {feature.title}
          </h2>

          <p className="text-base font-bold mb-6" style={{ color: 'rgba(249,250,251,.72)' }}>
            {feature.valueStatement}
          </p>

          {/* Steps */}
          <div className="mb-6">
            <ol className="space-y-3">
              {feature.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                    style={{
                      background: 'rgba(184,202,110,.15)',
                      color: '#B8CA6E',
                    }}
                  >
                    {index + 1}
                  </span>
                  <span
                    className="text-sm font-bold pt-0.5"
                    style={{ color: 'rgba(249,250,251,.72)' }}
                  >
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={ctaHref}
              onClick={handleCTAClick}
              className="flex-1 h-12 px-6 bg-[#B8CA6E] text-[#1a1410] font-black rounded-xl hover:bg-[#c9d88a] transition-colors flex items-center justify-center gap-2"
              style={{ boxShadow: '0 8px 20px rgba(184,202,110,.2)' }}
            >
              {feature.cta.label}
              <ChevronRight className="w-4 h-4" />
            </Link>

            {feature.secondaryCta && (
              <button
                onClick={handleSecondaryCTAClick}
                className="flex-1 h-12 px-6 font-bold rounded-xl transition-colors flex items-center justify-center"
                style={{
                  background: 'rgba(255,255,255,.08)',
                  color: 'rgba(249,250,251,.72)',
                  border: '1px solid rgba(148,163,184,.16)',
                }}
              >
                {feature.secondaryCta.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
