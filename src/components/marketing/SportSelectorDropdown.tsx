'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export function SportSelectorDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div ref={ref} className="relative inline-block w-full sm:w-auto">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="font-black rounded-2xl h-14 px-8 inline-flex items-center justify-center transition-colors hover:bg-[#c9d88a] w-full sm:w-auto"
        style={{
          background: '#B8CA6E',
          color: '#1a1410',
          boxShadow: '0 14px 28px rgba(184,202,110,0.25)',
        }}
      >
        Get Started {isOpen ? '↑' : '→'}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 min-w-[280px] w-full sm:w-auto rounded-2xl p-3 backdrop-blur-sm z-50"
          style={{
            background: 'rgba(26,20,16,0.96)',
            border: '1px solid rgba(148,163,184,0.20)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.40)',
          }}
        >
          <p
            className="text-xs font-black tracking-[0.15em] uppercase px-3 py-2 mb-1"
            style={{ color: 'rgba(249,250,251,0.40)' }}
          >
            Choose your sport
          </p>

          {/* Football — active */}
          <Link
            href="/football"
            onClick={() => setIsOpen(false)}
            className="flex items-center px-3 py-3 rounded-xl transition-colors"
            style={{ color: '#F9FAFB' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184,202,110,0.10)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span className="text-base">🏈</span>
            <span className="text-sm font-bold ml-3" style={{ color: '#F9FAFB' }}>Football</span>
            <span className="ml-auto text-xs font-bold" style={{ color: '#B8CA6E' }}>Available Now →</span>
          </Link>

          {/* Divider */}
          <div className="mx-2 my-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          {/* Inactive sports */}
          {[
            { emoji: '⚾', name: 'Baseball' },
            { emoji: '🏀', name: 'Basketball' },
            { emoji: '⚽', name: 'Soccer' },
            { emoji: '🥍', name: 'Lacrosse' },
          ].map((sport) => (
            <div
              key={sport.name}
              className="flex items-center px-3 py-3 rounded-xl opacity-50 cursor-default"
            >
              <span className="text-base">{sport.emoji}</span>
              <span className="text-sm font-bold ml-3" style={{ color: 'rgba(249,250,251,0.50)' }}>
                {sport.name}
              </span>
              <span className="ml-auto text-xs" style={{ color: 'rgba(249,250,251,0.35)' }}>
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
