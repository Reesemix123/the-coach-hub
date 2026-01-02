'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGlobalOnboardingSafe } from './GlobalOnboardingProvider';
import { TOUR_STEPS } from '@/types/onboarding';

export default function OnboardingTourModal() {
  const onboarding = useGlobalOnboardingSafe();
  const [currentStep, setCurrentStep] = useState(0);

  const showTour = onboarding?.showTour ?? false;

  // Reset to first step whenever tour opens
  useEffect(() => {
    if (showTour) {
      setCurrentStep(0);
    }
  }, [showTour]);

  // Don't render if not in provider context
  if (!onboarding) {
    return null;
  }

  const { completeTour, skipTour } = onboarding;

  if (!showTour) {
    return null;
  }

  const step = TOUR_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      completeTour();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    skipTour();
  };

  const handleClose = () => {
    skipTour();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[#161b22] border border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-[#1e2a3a] rounded-full transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Image */}
          <div className="relative w-full aspect-[16/10] bg-gray-100 rounded-xl overflow-hidden mb-6 border border-gray-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={step.image}
              alt={step.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Decorative emoji badge in top-right corner */}
            <div className="absolute top-3 right-3 w-12 h-12 bg-[#1e2a3a] border border-gray-700 rounded-full shadow-lg flex items-center justify-center">
              <span className="text-2xl">
                {['👋', '📊', '🏈', '📋', '🏃', '📝', '🎬', '🏷️', '📈', '🚀'][currentStep]}
              </span>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-white mb-3">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-gray-300 leading-relaxed mb-6">
            {step.description}
          </p>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {TOUR_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-[#a3e635] scale-110'
                    : index < currentStep
                    ? 'bg-[#a3e635]/50'
                    : 'bg-gray-700'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-3">
              {!isFirstStep && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 px-4 py-2 text-gray-300 hover:bg-[#1e2a3a] rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-6 py-2 bg-[#a3e635] text-[#0d1117] font-semibold rounded-lg hover:bg-[#bef264] transition-colors"
              >
                {isLastStep ? (
                  'Get Started'
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-[#a3e635] transition-all duration-300"
            style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
