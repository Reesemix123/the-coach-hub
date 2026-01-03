/**
 * SplitSection Component
 *
 * Split layout with left content (prompts list) and right panel (chat mock).
 * Used for the AI Co-pilot section.
 */

'use client';

interface SplitSectionProps {
  label?: string;
  headline?: string;
  subheadline?: string;
}

const samplePrompts = [
  "Design a goal-line package for my team",
  "What's our success rate on 3rd and short?",
  "Show me all jet sweep plays from this season",
  "Create a practice plan for Tuesday",
  "Analyze our red zone tendencies",
];

export default function SplitSection({
  label = 'AI-Powered',
  headline = 'Meet Your\nCoaching Co-Pilot',
  subheadline = 'An AI assistant that understands football and your team. Ask questions, get insights, and build plays with natural conversation.',
}: SplitSectionProps) {
  return (
    <section className="marketing-section-lg bg-[#0F172A]">
      <div className="marketing-container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Side - Content */}
          <div>
            <span className="marketing-label mb-4 inline-block">{label}</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight mb-6 whitespace-pre-line">
              {headline.split('\n').map((line, i) => (
                <span key={i}>
                  {line}
                  {i < headline.split('\n').length - 1 && <br />}
                </span>
              ))}
            </h2>
            <p className="text-lg text-[rgba(249,250,251,0.72)] mb-8 leading-relaxed">
              {subheadline}
            </p>

            {/* Sample Prompts */}
            <div className="space-y-3">
              <p className="text-sm text-[rgba(249,250,251,0.56)] mb-3">Try asking:</p>
              {samplePrompts.map((prompt, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(17,24,39,0.5)] border border-[rgba(148,163,184,0.12)] hover:border-[rgba(148,163,184,0.24)] transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[rgba(163,230,53,0.1)] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[#A3E635]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-[rgba(249,250,251,0.8)] text-sm group-hover:text-white transition-colors">
                    {prompt}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Chat Mock Panel */}
          <div className="relative">
            <div className="marketing-card !p-0 overflow-hidden">
              {/* Chat Header */}
              <div className="px-5 py-4 border-b border-[rgba(148,163,184,0.18)] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#A3E635] to-[#84CC16] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#0F172A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-medium text-sm">Coach AI</h4>
                  <p className="text-[rgba(249,250,251,0.56)] text-xs">Your football assistant</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#A3E635] animate-pulse" />
                  <span className="text-[#A3E635] text-xs">Online</span>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="p-5 space-y-4 min-h-[320px]">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] p-3 rounded-2xl rounded-br-md bg-[#A3E635] text-[#0F172A]">
                    <p className="text-sm font-medium">
                      What&apos;s our best play on 3rd and short this season?
                    </p>
                  </div>
                </div>

                {/* AI Response */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] p-4 rounded-2xl rounded-bl-md bg-[rgba(30,41,59,0.8)] border border-[rgba(148,163,184,0.12)]">
                    <p className="text-[rgba(249,250,251,0.9)] text-sm leading-relaxed mb-3">
                      Based on your film data, your most effective 3rd and short play is <span className="text-[#A3E635] font-medium">Power Right</span> from I-Formation:
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between text-[rgba(249,250,251,0.72)]">
                        <span>Success Rate</span>
                        <span className="text-[#A3E635] font-semibold">78%</span>
                      </div>
                      <div className="flex items-center justify-between text-[rgba(249,250,251,0.72)]">
                        <span>Avg. Yards</span>
                        <span className="text-white font-medium">4.2</span>
                      </div>
                      <div className="flex items-center justify-between text-[rgba(249,250,251,0.72)]">
                        <span>Times Used</span>
                        <span className="text-white font-medium">14</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[rgba(148,163,184,0.12)]">
                      <p className="text-[rgba(249,250,251,0.56)] text-xs">
                        Would you like me to show the play diagram or suggest alternatives?
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Input */}
              <div className="px-5 py-4 border-t border-[rgba(148,163,184,0.18)]">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(17,24,39,0.5)] border border-[rgba(148,163,184,0.12)]">
                  <input
                    type="text"
                    placeholder="Ask about your team..."
                    className="flex-1 bg-transparent text-white text-sm placeholder-[rgba(249,250,251,0.4)] outline-none"
                    disabled
                  />
                  <button className="w-8 h-8 rounded-lg bg-[#A3E635] flex items-center justify-center hover:bg-[#84CC16] transition-colors">
                    <svg className="w-4 h-4 text-[#0F172A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Decorative Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-[rgba(163,230,53,0.1)] to-transparent rounded-3xl blur-2xl -z-10 opacity-50" />
          </div>
        </div>
      </div>
    </section>
  );
}
