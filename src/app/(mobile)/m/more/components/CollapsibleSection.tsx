'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  summary?: string
  defaultExpanded?: boolean
  children: ReactNode
  onCollapse?: () => void
}

export default function CollapsibleSection({
  title,
  summary,
  defaultExpanded = false,
  children,
  onCollapse,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [expanded, children])

  function toggle() {
    if (expanded) {
      setExpanded(false)
      onCollapse?.()
    } else {
      setExpanded(true)
    }
  }

  return (
    <div className="bg-white rounded-xl mx-4 overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-gray-900">{title}</p>
          {!expanded && summary && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{summary}</p>
          )}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className={`text-gray-400 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        style={{ maxHeight: expanded ? `${contentHeight}px` : '0px' }}
        className="transition-[max-height] duration-200 ease-in-out overflow-hidden"
      >
        <div ref={contentRef} className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}
