// src/components/playbuilder/ValidationModal.tsx
'use client';

import { getValidationSummary, type FormationValidation } from '@/config/footballRules';

interface ValidationModalProps {
  isOpen: boolean;
  validationResult: FormationValidation | null;
  onClose: () => void;
  onSaveAnyway: () => void;
}

export function ValidationModal({
  isOpen,
  validationResult,
  onClose,
  onSaveAnyway
}: ValidationModalProps) {
  if (!isOpen || !validationResult) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">
              Formation Validation
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className={`mb-4 p-4 rounded-lg ${
            validationResult.isValid 
              ? 'bg-yellow-50 border border-yellow-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className="font-semibold text-gray-900">
              {getValidationSummary(validationResult)}
            </p>
          </div>

          {validationResult.errors.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-red-700 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Critical Errors (Must Fix)
              </h4>
              <ul className="space-y-2">
                {validationResult.errors.map((error, idx) => (
                  <li key={idx} className="text-sm text-red-700 bg-red-50 p-3 rounded">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.warnings.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-yellow-700 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Warnings (Review Recommended)
              </h4>
              <ul className="space-y-2">
                {validationResult.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Coach's Note:</strong> These validations ensure your plays follow official football rules. 
              {validationResult.errors.length > 0 
                ? ' Critical errors indicate this formation would likely draw a penalty in a real game. Review and adjust player positions, or save anyway if this is intentional for practice/demonstration purposes.'
                : ' Warnings are suggestions - you can save if this is intentional for your scheme.'}
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Go Back & Fix
            </button>
            
            <button
              onClick={onSaveAnyway}
              className={`px-4 py-2 rounded-lg text-white transition-colors ${
                validationResult.errors.length > 0
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
            >
              {validationResult.errors.length > 0 ? 'Save Anyway (Override)' : 'Save Anyway'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}