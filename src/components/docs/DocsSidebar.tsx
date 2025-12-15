'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, Rocket, Users, BookOpen, Video, BarChart3, Calendar, Shield, CreditCard, Sparkles, HelpCircle } from 'lucide-react';
import { docsNavigation, type DocSection } from '@/config/docs-navigation';

// Map icon names to components
const iconMap: Record<string, React.ElementType> = {
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

interface DocsSidebarProps {
  className?: string;
}

export function DocsSidebar({ className = '' }: DocsSidebarProps) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Auto-expand the section containing the current page
    const pathParts = pathname.replace('/guide/', '').split('/');
    if (pathParts[0]) {
      return new Set([pathParts[0]]);
    }
    // Default: expand first section
    return new Set([docsNavigation[0]?.slug || '']);
  });

  const toggleSection = (slug: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const isActive = (section: DocSection, child?: DocSection) => {
    const path = child
      ? `/guide/${section.slug}/${child.slug}`
      : `/guide/${section.slug}`;
    return pathname === path;
  };

  return (
    <nav className={`space-y-1 ${className}`}>
      {docsNavigation.map(section => {
        const Icon = section.icon ? iconMap[section.icon] : null;
        const isExpanded = expandedSections.has(section.slug);
        const hasActiveChild = section.children?.some(child => isActive(section, child));

        return (
          <div key={section.slug}>
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.slug)}
              className={`
                w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${hasActiveChild ? 'text-gray-900 bg-gray-100' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}
              `}
            >
              <span className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4" />}
                {section.title}
              </span>
              {section.children && (
                isExpanded
                  ? <ChevronDown className="h-4 w-4 text-gray-400" />
                  : <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {/* Children */}
            {isExpanded && section.children && (
              <div className="mt-1 ml-6 space-y-1">
                {section.children.map(child => (
                  <Link
                    key={child.slug}
                    href={`/guide/${section.slug}/${child.slug}`}
                    className={`
                      block px-3 py-1.5 text-sm rounded-lg transition-colors
                      ${isActive(section, child)
                        ? 'text-gray-900 bg-gray-100 font-medium'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
                      ${child.comingSoon ? 'opacity-60' : ''}
                    `}
                  >
                    <span className="flex items-center gap-2">
                      {child.title}
                      {child.comingSoon && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded">
                          Soon
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default DocsSidebar;
