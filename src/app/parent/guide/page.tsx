import Link from 'next/link';
import { parentDocsNavigation } from '@/config/docs-navigation';
import { ChevronLeft, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Parent Help Guide | Youth Coach Hub',
  description: 'Everything you need to know about Youth Coach Hub for parents.',
};

export default function ParentGuidePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/parent"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Parent Help Guide
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Everything you need to know about Youth Coach Hub for parents.
          </p>
        </div>

        {/* Quick Start */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/parent/guide/parent-getting-started/welcome"
              className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">👋</span>
                <span className="font-medium text-gray-900">Welcome</span>
              </div>
              <p className="text-sm text-gray-600">What Youth Coach Hub does for you.</p>
            </Link>
            <Link
              href="/parent/guide/parent-getting-started/athlete-profile"
              className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">👤</span>
                <span className="font-medium text-gray-900">Create a Profile</span>
              </div>
              <p className="text-sm text-gray-600">Set up your athlete&apos;s profile.</p>
            </Link>
            <Link
              href="/parent/guide/parent-clips/finding-clips"
              className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎬</span>
                <span className="font-medium text-gray-900">Find Clips</span>
              </div>
              <p className="text-sm text-gray-600">Where to find your child&apos;s highlights.</p>
            </Link>
          </div>
        </section>

        {/* All Sections */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Topics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {parentDocsNavigation.map((section) => (
              <Link
                key={section.slug}
                href={`/parent/guide/${section.slug}`}
                className="group p-4 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {section.icon && <span className="text-lg">{section.icon}</span>}
                    <span className="font-medium text-gray-900">{section.title}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
                {section.children && (
                  <p className="text-sm text-gray-500">
                    {section.children.length} article{section.children.length !== 1 ? 's' : ''}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* Help Footer */}
        <section className="mt-10 pt-8 border-t border-gray-200">
          <div className="bg-gray-50 rounded-lg p-5">
            <h3 className="font-medium text-gray-900 mb-1">Still need help?</h3>
            <p className="text-sm text-gray-600">
              Use the AI Assistant (the floating button) to ask a question, or contact your coach directly through the Messages tab.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
