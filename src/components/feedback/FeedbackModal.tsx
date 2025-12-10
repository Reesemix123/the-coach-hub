'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Check, Loader2, ExternalLink } from 'lucide-react';
import html2canvas from 'html2canvas';
import { createClient } from '@/utils/supabase/client';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackType = 'bug' | 'confusing' | 'missing' | 'suggestion';

const feedbackTypes: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Something isn\'t working' },
  { value: 'confusing', label: 'Something is confusing' },
  { value: 'missing', label: 'Something is missing' },
  { value: 'suggestion', label: 'I have a suggestion' },
];

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Capture screenshot when modal opens
  useEffect(() => {
    if (isOpen && !screenshot) {
      // Small delay to ensure portal is mounted before we try to hide/capture
      const timer = setTimeout(() => {
        captureScreenshot();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setSelectedType(null);
        setDescription('');
        setScreenshot(null);
        setScreenshotBlob(null);
        setShowPreview(false);
        setSubmitted(false);
        setError(null);
      }, 300);
    }
  }, [isOpen]);

  async function captureScreenshot() {
    setIsCapturing(true);
    console.log('[Feedback] Starting screenshot capture...');
    try {
      // Find and hide the modal overlay temporarily for screenshot
      const overlay = document.getElementById('feedback-modal-overlay');
      console.log('[Feedback] Overlay found:', !!overlay);
      if (overlay) {
        overlay.style.display = 'none';
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      console.log('[Feedback] Calling html2canvas...');
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        logging: true, // Enable logging to see what html2canvas is doing
        scale: window.devicePixelRatio > 1 ? 1 : window.devicePixelRatio, // Handle retina displays
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        ignoreElements: (element) => {
          return element.id === 'feedback-modal-overlay';
        }
      });
      console.log('[Feedback] Canvas created:', canvas.width, 'x', canvas.height);

      // Show the overlay again
      if (overlay) {
        overlay.style.display = '';
      }

      const dataUrl = canvas.toDataURL('image/png');
      console.log('[Feedback] Data URL length:', dataUrl.length);
      setScreenshot(dataUrl);

      // Convert to blob for upload
      canvas.toBlob((blob) => {
        console.log('[Feedback] Blob created:', blob?.size);
        if (blob) {
          setScreenshotBlob(blob);
        }
      }, 'image/png');
    } catch (err) {
      console.error('[Feedback] Screenshot capture failed:', err);
      // Show overlay again even if screenshot fails
      const overlay = document.getElementById('feedback-modal-overlay');
      if (overlay) {
        overlay.style.display = '';
      }
    } finally {
      setIsCapturing(false);
      console.log('[Feedback] Screenshot capture complete');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedType || !description.trim()) {
      setError('Please select a feedback type and provide a description.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to submit feedback.');
        return;
      }

      // Get current team if available
      const teamId = localStorage.getItem('currentTeamId');

      // Upload screenshot if available
      let screenshotUrl: string | null = null;
      if (screenshotBlob) {
        const fileName = `${user.id}/${Date.now()}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('feedback-screenshots')
          .upload(fileName, screenshotBlob, {
            contentType: 'image/png',
          });

        if (uploadError) {
          console.error('Screenshot upload error:', uploadError);
        } else if (uploadData) {
          // Get signed URL (valid for 1 year)
          const { data: urlData } = await supabase.storage
            .from('feedback-screenshots')
            .createSignedUrl(fileName, 31536000);
          screenshotUrl = urlData?.signedUrl || null;
        }
      }

      // Collect browser info
      const browserInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      };

      // Submit feedback
      const { error: insertError } = await supabase
        .from('feedback_reports')
        .insert({
          user_id: user.id,
          team_id: teamId || null,
          type: selectedType,
          description: description.trim(),
          page_url: window.location.href,
          screenshot_url: screenshotUrl,
          browser_info: browserInfo,
          status: 'new',
        });

      if (insertError) {
        console.error('Feedback submission error:', insertError);
        setError('Failed to submit feedback. Please try again.');
        return;
      }

      setSubmitted(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Feedback submission error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  // Use portal to render modal at document body level to avoid stacking context issues
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="feedback-modal-overlay"
      className="fixed inset-0 bg-black/50 z-[9999] overflow-y-auto"
    >
      <div
        className="min-h-full flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          ref={modalRef}
          className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden my-8"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Share Feedback</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          // Success state
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Thank you!</h3>
            <p className="text-gray-600">We'll review your feedback and get back to you if needed.</p>
          </div>
        ) : (
          // Form
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Feedback Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What type of feedback?
              </label>
              <div className="space-y-2">
                {feedbackTypes.map((type) => (
                  <label
                    key={type.value}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                      ${selectedType === type.value
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="feedbackType"
                      value={type.value}
                      checked={selectedType === type.value}
                      onChange={() => setSelectedType(type.value)}
                      className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-900">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tell us more
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your feedback in detail..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
              />
            </div>

            {/* Screenshot section */}
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50">
                <div className="flex items-center gap-2">
                  {isCapturing ? (
                    <>
                      <Loader2 size={16} className="text-gray-500 animate-spin" />
                      <span className="text-sm text-gray-600">Capturing screenshot...</span>
                    </>
                  ) : screenshot ? (
                    <>
                      <Camera size={16} className="text-green-600" />
                      <span className="text-sm text-gray-600">Screenshot attached</span>
                      <Check size={14} className="text-green-600" />
                    </>
                  ) : (
                    <>
                      <Camera size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-500">No screenshot</span>
                    </>
                  )}
                </div>
                {screenshot && (
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshot(null);
                      setScreenshotBlob(null);
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
              {screenshot && (
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="w-full p-2 hover:bg-gray-50 transition-colors"
                >
                  <img
                    src={screenshot}
                    alt="Screenshot preview"
                    className="w-full h-24 object-cover object-top rounded border border-gray-200"
                  />
                  <span className="text-xs text-gray-500 mt-1 block">Click to enlarge</span>
                </button>
              )}
              <p className="text-xs text-gray-400 px-3 py-2 bg-gray-50 border-t border-gray-100">
                Screenshot only captures this app window, nothing else on your screen.
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedType || !description.trim()}
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>

      {/* Screenshot Preview Modal */}
      {showPreview && screenshot && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4"
          onClick={() => setShowPreview(false)}
        >
          <div className="relative max-w-4xl max-h-[80vh] overflow-auto">
            <button
              onClick={() => setShowPreview(false)}
              className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
            >
              <X size={20} />
            </button>
            <img
              src={screenshot}
              alt="Screenshot preview"
              className="rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export default FeedbackModal;
