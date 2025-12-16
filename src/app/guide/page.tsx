import Link from 'next/link';
import { DocsSidebar, MobileDocNav } from '@/components/docs';
import { docsNavigation } from '@/config/docs-navigation';
import { Rocket, Users, BookOpen, ClipboardList, Video, BarChart3, Calendar, Shield, CreditCard, Sparkles, HelpCircle, ArrowRight } from 'lucide-react';

// Map icon names to components
const iconMap: Record<string, React.ElementType> = {
  Rocket,
  Users,
  BookOpen,
  ClipboardList,
  Video,
  BarChart3,
  Calendar,
  Shield,
  CreditCard,
  Sparkles,
  HelpCircle,
};

export const metadata = {
  title: 'User Guide | Youth Coach Hub',
  description: 'Learn how to use Youth Coach Hub to manage your team, build playbooks, and analyze game film.',
};

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 scrollbar-thin">
              <DocsSidebar />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 max-w-3xl">
            {/* Mobile Navigation */}
            <div className="lg:hidden mb-4">
              <MobileDocNav />
            </div>

            {/* Hero */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="h-8 w-8 text-gray-900" />
                <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight">
                  User Guide
                </h1>
              </div>
              <p className="text-xl text-gray-600 max-w-2xl">
                Everything you need to know about managing your team, building playbooks,
                tagging game film, and using analytics to improve your coaching.
              </p>
            </div>

            {/* Quick Start */}
            <section className="mb-12">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  href="/guide/getting-started/creating-first-team"
                  className="group p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Rocket className="h-5 w-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Create Your First Team</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Set up your team and invite your coaching staff.
                  </p>
                </Link>

                <Link
                  href="/guide/film/uploading-film"
                  className="group p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Video className="h-5 w-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Upload Game Film</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Get your game footage into the platform.
                  </p>
                </Link>

                <Link
                  href="/guide/film/tagging-plays"
                  className="group p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <BarChart3 className="h-5 w-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Tag Your First Game</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Start tagging plays to unlock analytics.
                  </p>
                </Link>
              </div>
            </section>

            {/* All Sections */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">All Topics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {docsNavigation.map(section => {
                  const Icon = section.icon ? iconMap[section.icon] : null;
                  return (
                    <Link
                      key={section.slug}
                      href={`/guide/${section.slug}`}
                      className="group p-4 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-5 w-5 text-gray-600" />}
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
                  );
                })}
              </div>
            </section>

            {/* Help Footer */}
            <section className="mt-12 pt-8 border-t border-gray-200">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-medium text-gray-900 mb-2">Need more help?</h3>
                <p className="text-gray-600 mb-4">
                  Can't find what you're looking for? We're here to help.
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/guide/support/providing-feedback"
                    className="text-sm font-medium text-gray-900 hover:text-gray-700"
                  >
                    Send Feedback
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link
                    href="/guide/support/reporting-bugs"
                    className="text-sm font-medium text-gray-900 hover:text-gray-700"
                  >
                    Report a Bug
                  </Link>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
