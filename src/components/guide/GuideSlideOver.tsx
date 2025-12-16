'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { useGuide } from '@/contexts/GuideContext';
import { docsNavigation, findSectionByPath } from '@/config/docs-navigation';
import { DocRenderer } from '@/components/docs';

export function GuideSlideOver() {
  const { isOpen, currentPath, content, title, description, isLoading, closeGuide, openGuide } = useGuide();

  // Lock body scroll when open
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

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeGuide();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeGuide]);

  // Get section info for breadcrumb and navigation
  const currentSection = currentPath && currentPath.length > 0
    ? docsNavigation.find(s => s.slug === currentPath[0])
    : null;

  const currentChild = currentSection && currentPath && currentPath.length > 1
    ? currentSection.children?.find(c => c.slug === currentPath[1])
    : null;

  // Check if we're viewing a section overview (no child selected)
  const isViewingSection = currentPath && currentPath.length === 1 && currentSection?.children;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeGuide}
      />

      {/* Slide-over Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[500px] md:w-[550px] lg:w-[600px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm">
              <button
                onClick={() => openGuide(['getting-started'])}
                className="text-gray-500 hover:text-gray-700"
              >
                User Guide
              </button>
              {currentSection && (
                <>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  <button
                    onClick={() => openGuide([currentSection.slug])}
                    className={currentChild ? 'text-gray-500 hover:text-gray-700' : 'text-gray-900 font-medium'}
                  >
                    {currentSection.title}
                  </button>
                </>
              )}
              {currentChild && (
                <>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900 font-medium">{currentChild.title}</span>
                </>
              )}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {currentPath && (
                <Link
                  href={`/guide/${currentPath.join('/')}`}
                  onClick={closeGuide}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  title="Open in full page"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Full Page</span>
                </Link>
              )}
              <button
                onClick={closeGuide}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-65px)] overflow-y-auto">
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : isViewingSection && currentSection?.children ? (
              // Section overview with topic list
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                  {currentSection.title}
                </h1>
                <p className="text-gray-600 mb-6">
                  Choose a topic below to learn more:
                </p>
                <div className="space-y-1">
                  {currentSection.children.map((child) => (
                    <button
                      key={child.slug}
                      onClick={() => openGuide([currentSection.slug, child.slug])}
                      className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                    >
                      <span className="text-gray-900 group-hover:text-black">
                        {child.title}
                      </span>
                      {child.comingSoon ? (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded">
                          Coming Soon
                        </span>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : content ? (
              // Render markdown content
              <DocRenderer
                content={content}
                title={title || undefined}
                description={description || undefined}
              />
            ) : (
              // No content state
              <div className="text-center py-20">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {title || 'Coming Soon'}
                </h2>
                <p className="text-gray-600">
                  {description || 'This documentation is being written. Check back soon!'}
                </p>
              </div>
            )}
          </div>

          {/* Section Navigation (when viewing a topic) */}
          {currentSection?.children && currentChild && (
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                More in {currentSection.title}
              </p>
              <div className="flex flex-wrap gap-2">
                {currentSection.children.map((child) => (
                  <button
                    key={child.slug}
                    onClick={() => openGuide([currentSection.slug, child.slug])}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      child.slug === currentChild?.slug
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {child.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default GuideSlideOver;
