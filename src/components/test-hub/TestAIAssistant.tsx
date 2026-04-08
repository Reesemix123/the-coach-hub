'use client';

import { Sparkles } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface TestAIAssistantProps {
  testCaseId: string;
  sessionId: string;
}

// ============================================
// COMPONENT
// ============================================

export function TestAIAssistant({
  testCaseId: _testCaseId,
  sessionId: _sessionId,
}: TestAIAssistantProps) {
  return (
    <div className="h-full flex flex-col bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-2">
        <Sparkles size={16} className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-900">AI Assistant</span>
      </div>

      {/* Body — empty state */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Sparkles size={24} className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-700">AI Test Assistant</p>
        <p className="text-xs text-gray-400 mt-1 text-center">
          Context-aware help for this test case coming in Phase 3
        </p>
      </div>
    </div>
  );
}
