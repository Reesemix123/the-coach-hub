'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PlaybookPlay } from '@/types/football';
import {
  ODK_CATEGORIES,
  CategoryPath,
  ODKType,
  CategoryCount,
  getOffenseCategoryCounts,
  getOffenseFormationCounts,
  getDefenseCategoryCounts,
  getDefenseFrontCounts,
  getSpecialTeamsCounts
} from '@/config/playbookCategories';

interface PlaybookCategorySidebarProps {
  plays: PlaybookPlay[];
  categoryPath: CategoryPath;
  onCategoryChange: (path: CategoryPath) => void;
}

export default function PlaybookCategorySidebar({
  plays,
  categoryPath,
  onCategoryChange
}: PlaybookCategorySidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Get counts for each ODK
  const offenseCount = plays.filter(p => p.attributes?.odk === 'offense').length;
  const defenseCount = plays.filter(p => p.attributes?.odk === 'defense').length;
  const specialTeamsCount = plays.filter(p => p.attributes?.odk === 'specialTeams').length;

  const toggleExpanded = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleODKChange = (odk: ODKType) => {
    onCategoryChange({
      odk,
      category: null,
      subcategory: null,
      viewMode: 'playType'
    });
  };

  const handleCategoryClick = (category: string) => {
    if (categoryPath.category === category && !categoryPath.subcategory) {
      // Clicking same category - clear it
      onCategoryChange({
        ...categoryPath,
        category: null,
        subcategory: null
      });
    } else {
      onCategoryChange({
        ...categoryPath,
        category,
        subcategory: null
      });
      // Auto-expand
      setExpandedCategories(prev => new Set(prev).add(category));
    }
  };

  const handleSubcategoryClick = (category: string, subcategory: string) => {
    if (categoryPath.category === category && categoryPath.subcategory === subcategory) {
      // Clicking same subcategory - go back to category level
      onCategoryChange({
        ...categoryPath,
        subcategory: null
      });
    } else {
      onCategoryChange({
        ...categoryPath,
        category,
        subcategory
      });
    }
  };

  const handleViewModeToggle = () => {
    onCategoryChange({
      ...categoryPath,
      category: null,
      subcategory: null,
      viewMode: categoryPath.viewMode === 'playType' ? 'formation' : 'playType'
    });
  };

  const renderCategoryList = (categories: CategoryCount[], showSubcategories: boolean = true) => {
    return (
      <div className="space-y-0.5">
        {categories.map(cat => {
          const isExpanded = expandedCategories.has(cat.key);
          const isSelected = categoryPath.category === cat.key;
          const hasSubcategories = showSubcategories && cat.subcategories && cat.subcategories.length > 0;

          return (
            <div key={cat.key}>
              {/* Category Header */}
              <button
                onClick={() => {
                  if (hasSubcategories) {
                    toggleExpanded(cat.key);
                  }
                  handleCategoryClick(cat.key);
                }}
                className={`
                  w-full flex items-center justify-between px-4 py-2.5 text-left
                  transition-colors text-sm
                  ${isSelected && !categoryPath.subcategory
                    ? 'bg-gray-900 text-white'
                    : 'hover:bg-gray-100 text-gray-900'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  {hasSubcategories ? (
                    isExpanded ? (
                      <ChevronDown className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )
                  ) : (
                    <span className="w-4" />
                  )}
                  <span className="font-medium">{cat.label}</span>
                </div>
                <span className={`
                  px-2 py-0.5 text-xs rounded-full
                  ${isSelected && !categoryPath.subcategory
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 text-gray-600'
                  }
                `}>
                  {cat.count}
                </span>
              </button>

              {/* Subcategories */}
              {hasSubcategories && isExpanded && (
                <div className="bg-gray-50 border-l-2 border-gray-200 ml-4">
                  {cat.subcategories!.map(sub => {
                    const isSubSelected = isSelected && categoryPath.subcategory === sub.key;
                    return (
                      <button
                        key={sub.key}
                        onClick={() => handleSubcategoryClick(cat.key, sub.key)}
                        className={`
                          w-full flex items-center justify-between pl-6 pr-4 py-2 text-left text-sm
                          transition-colors
                          ${isSubSelected
                            ? 'bg-gray-900 text-white'
                            : 'hover:bg-gray-100 text-gray-600'
                          }
                        `}
                      >
                        <span>{sub.label}</span>
                        <span className={`
                          text-xs
                          ${isSubSelected ? 'text-white/70' : 'text-gray-500'}
                        `}>
                          {sub.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderOffenseContent = () => {
    const playCounts = getOffenseCategoryCounts(plays);
    const formationCounts = getOffenseFormationCounts(plays);

    return (
      <>
        {/* View Mode Toggle */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => categoryPath.viewMode !== 'playType' && handleViewModeToggle()}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryPath.viewMode === 'playType'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              By Play Type
            </button>
            <button
              onClick={() => categoryPath.viewMode !== 'formation' && handleViewModeToggle()}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryPath.viewMode === 'formation'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              By Formation
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="py-2">
          {categoryPath.viewMode === 'playType' ? (
            playCounts.length > 0 ? (
              renderCategoryList(playCounts)
            ) : (
              <p className="px-4 py-4 text-sm text-gray-500">No offensive plays</p>
            )
          ) : (
            formationCounts.length > 0 ? (
              renderCategoryList(formationCounts, false)
            ) : (
              <p className="px-4 py-4 text-sm text-gray-500">No offensive plays</p>
            )
          )}
        </div>
      </>
    );
  };

  const renderDefenseContent = () => {
    const coverageCounts = getDefenseCategoryCounts(plays);
    const frontCounts = getDefenseFrontCounts(plays);

    return (
      <>
        {/* View Mode Toggle */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => categoryPath.viewMode !== 'playType' && handleViewModeToggle()}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryPath.viewMode === 'playType'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              By Coverage
            </button>
            <button
              onClick={() => categoryPath.viewMode !== 'formation' && handleViewModeToggle()}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryPath.viewMode === 'formation'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              By Front
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="py-2">
          {categoryPath.viewMode === 'playType' ? (
            coverageCounts.length > 0 ? (
              renderCategoryList(coverageCounts)
            ) : (
              <p className="px-4 py-4 text-sm text-gray-500">No defensive plays</p>
            )
          ) : (
            frontCounts.length > 0 ? (
              renderCategoryList(frontCounts, false)
            ) : (
              <p className="px-4 py-4 text-sm text-gray-500">No defensive plays</p>
            )
          )}
        </div>
      </>
    );
  };

  const renderSpecialTeamsContent = () => {
    const unitCounts = getSpecialTeamsCounts(plays);

    return (
      <div className="py-2">
        {unitCounts.length > 0 ? (
          renderCategoryList(unitCounts, false)
        ) : (
          <p className="px-4 py-4 text-sm text-gray-500">No special teams plays</p>
        )}
      </div>
    );
  };

  return (
    <div className="w-72 bg-white border border-gray-200 rounded-xl overflow-hidden flex-shrink-0 flex flex-col">
      {/* ODK Tabs */}
      <div className="flex border-b border-gray-200">
        {ODK_CATEGORIES.map(odk => {
          const count = odk.value === 'offense' ? offenseCount :
                       odk.value === 'defense' ? defenseCount : specialTeamsCount;
          const isActive = categoryPath.odk === odk.value;

          return (
            <button
              key={odk.value}
              onClick={() => handleODKChange(odk.value as ODKType)}
              className={`
                flex-1 px-2 py-3 text-sm font-medium transition-colors relative
                ${isActive
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span>{odk.label}</span>
                <span className={`text-xs ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                  {count}
                </span>
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content based on selected ODK */}
      <div className="flex-1 overflow-y-auto">
        {categoryPath.odk === 'offense' && renderOffenseContent()}
        {categoryPath.odk === 'defense' && renderDefenseContent()}
        {categoryPath.odk === 'specialTeams' && renderSpecialTeamsContent()}
        {!categoryPath.odk && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            Select a category above
          </div>
        )}
      </div>

      {/* Clear Filters */}
      {(categoryPath.category || categoryPath.subcategory) && (
        <div className="px-4 py-3 border-t border-gray-200">
          <button
            onClick={() => onCategoryChange({
              ...categoryPath,
              category: null,
              subcategory: null
            })}
            className="w-full text-sm text-gray-600 hover:text-gray-900"
          >
            Clear category filter
          </button>
        </div>
      )}
    </div>
  );
}
