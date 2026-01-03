/**
 * RealitySection Component
 *
 * "The Reality" section that addresses pain points before showing features.
 * Small label + big headline + paragraph.
 */

'use client';

interface RealitySectionProps {
  label?: string;
  headline?: string;
  description?: string;
}

export default function RealitySection({
  label = 'The Reality',
  headline = 'Coaching is Hard Enough.\nYour Tools Shouldn\'t Be.',
  description = 'You\'re juggling practice plans, game film, player development, and parent communication. You don\'t have time to wrestle with complicated software or scattered spreadsheets. You need tools built by coaches, for coaches.',
}: RealitySectionProps) {
  return (
    <section className="marketing-section bg-[#0F172A]">
      <div className="marketing-container">
        <div className="max-w-3xl mx-auto text-center">
          <span className="marketing-label mb-4 inline-block">{label}</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight mb-6 whitespace-pre-line">
            {headline.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < headline.split('\n').length - 1 && <br />}
              </span>
            ))}
          </h2>
          <p className="text-lg text-[rgba(249,250,251,0.72)] leading-relaxed">
            {description}
          </p>
        </div>

        {/* Subtle Divider */}
        <div className="marketing-divider mt-16" />
      </div>
    </section>
  );
}
