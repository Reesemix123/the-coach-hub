'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronRight,
  Rocket,
  Users,
  Video,
  BarChart3,
  Calendar,
  Shield,
  CreditCard,
  Sparkles,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { docsNavigation, DocSection } from '@/config/docs-navigation';
import { useGuide } from '@/contexts/GuideContext';

// Map icon names to components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Users,
  BookOpen,
  Video,
  BarChart3,
  Calendar,
  Shield,
  CreditCard,
  Sparkles,
  HelpCircle,
};

export function GuideDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { openGuide } = useGuide();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHoveredSection(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setHoveredSection(null);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleTopicClick = (section: DocSection, child?: DocSection) => {
    const path = child ? [section.slug, child.slug] : [section.slug];
    openGuide(path);
    setIsOpen(false);
    setHoveredSection(null);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
          isOpen
            ? 'text-gray-900 bg-gray-100'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
        title="Guide"
      >
        <BookOpen className="h-4 w-4" />
        <span className="hidden sm:inline">How To</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
          {/* Section List */}
          <div className="max-h-[400px] overflow-y-auto">
            {docsNavigation.map((section) => {
              const Icon = section.icon ? iconMap[section.icon] : BookOpen;
              const isHovered = hoveredSection === section.slug;

              return (
                <div
                  key={section.slug}
                  className="relative"
                  onMouseEnter={() => setHoveredSection(section.slug)}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <button
                    onClick={() => handleTopicClick(section)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                      isHovered ? 'bg-gray-50 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-gray-400" />
                      <span>{section.title}</span>
                    </span>
                    {section.children && section.children.length > 0 && (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </button>

                  {/* Submenu - Show on hover */}
                  {isHovered && section.children && section.children.length > 0 && (
                    <div
                      className="absolute left-full top-0 ml-1 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50"
                      onMouseEnter={() => setHoveredSection(section.slug)}
                    >
                      {section.children.map((child) => (
                        <button
                          key={child.slug}
                          onClick={() => handleTopicClick(section, child)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 text-left"
                        >
                          <span className="flex-1">{child.title}</span>
                          {child.comingSoon && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                              Soon
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-gray-100" />

          {/* View Complete Guide Link */}
          <Link
            href="/guide"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            <span>View Complete Guide</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default GuideDropdown;
