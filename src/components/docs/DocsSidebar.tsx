'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, ClipboardList, Rocket, Users, BookOpen, Video, BarChart3, Calendar, Shield, CreditCard, Sparkles, HelpCircle } from 'lucide-react';
import { docsNavigation, type DocSection } from '@/config/docs-navigation';

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

interface DocsSidebarProps {
  className?: string;
}

export function DocsSidebar({ className = '' }: DocsSidebarProps) {
  const pathname = usePathname();

  // Only expand the section containing the current page
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Sync expanded section with current pathname
  useEffect(() => {
    const pathParts = pathname.replace('/guide/', '').split('/');
    if (pathParts[0]) {
      setExpandedSections(new Set([pathParts[0]]));
    } else {
      setExpandedSections(new Set());
    }
  }, [pathname]);

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
      {docsNavigation.map((section, sectionIndex) => {
        const Icon = section.icon ? iconMap[section.icon] : null;
        const isExpanded = expandedSections.has(section.slug);
        const hasActiveChild = section.children?.some(child => isActive(section, child));

        return (
          <div
            key={section.slug}
            className={sectionIndex > 0 ? 'pt-4' : ''}
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.slug)}
              className={`
                w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${hasActiveChild ? 'text-gray-900 bg-gray-100' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}
              `}
            >
              <span className="flex items-center gap-2.5">
                {Icon && <Icon className="h-4 w-4 text-gray-400" />}
                {section.title}
              </span>
              {section.children && (
                isExpanded
                  ? <ChevronDown className="h-4 w-4 text-gray-400" />
                  : <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {/* Children - collapsed by default */}
            {isExpanded && section.children && (
              <div className="mt-1 ml-4 pl-3 border-l border-gray-200 space-y-0.5">
                {section.children.map(child => (
                  <Link
                    key={child.slug}
                    href={`/guide/${section.slug}/${child.slug}`}
                    className={`
                      block px-3 py-1.5 text-sm rounded-lg transition-colors
                      ${isActive(section, child)
                        ? 'text-gray-900 bg-gray-100 font-medium'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-normal'}
                      ${child.comingSoon ? 'opacity-50' : ''}
                    `}
                  >
                    {child.title}
                    {child.comingSoon && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">
                        Soon
                      </span>
                    )}
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
