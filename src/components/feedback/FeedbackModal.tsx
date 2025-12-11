'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Check, Upload, Loader2 } from 'lucide-react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setSelectedType(null);
        setDescription('');
        setScreenshot(null);
        setScreenshotBlob(null);
        setSubmitted(false);
        setError(null);
      }, 300);
    }
  }, [isOpen]);

  function processFile(file: File) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    // Read file as data URL for preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setScreenshot(event.target?.result as string);
      setScreenshotBlob(file);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
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
                  {screenshot ? (
                    <>
                      <Camera size={16} className="text-green-600" />
                      <span className="text-sm text-gray-600">Screenshot attached</span>
                      <Check size={14} className="text-green-600" />
                    </>
                  ) : (
                    <>
                      <Camera size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-500">Screenshot (optional)</span>
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
              {screenshot ? (
                <div className="p-2">
                  <img
                    src={screenshot}
                    alt="Screenshot preview"
                    className="w-full h-20 object-cover object-top rounded border border-gray-200"
                  />
                </div>
              ) : (
                <div className="p-3 space-y-3">
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full py-4 px-4 border-2 border-dashed rounded-lg text-sm cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 ${
                      isDragging
                        ? 'border-gray-900 bg-gray-100 text-gray-900'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Upload size={18} />
                    <span>{isDragging ? 'Drop image here' : 'Click or drag screenshot here'}</span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p className="font-medium text-gray-500">How to take a screenshot:</p>
                    <p><span className="font-medium">Mac:</span> Cmd + Shift + 4, then drag to select</p>
                    <p><span className="font-medium">Windows:</span> Win + Shift + S, then drag to select</p>
                  </div>
                </div>
              )}
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
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
    </div>,
    document.body
  );
}

export default FeedbackModal;
