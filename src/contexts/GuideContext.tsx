'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface GuideState {
  isOpen: boolean;
  currentPath: string[] | null;
  content: string | null;
  title: string | null;
  description: string | null;
  isLoading: boolean;
}

interface GuideContextType extends GuideState {
  openGuide: (path: string[]) => void;
  closeGuide: () => void;
}

const GuideContext = createContext<GuideContextType | null>(null);

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuideState>({
    isOpen: false,
    currentPath: null,
    content: null,
    title: null,
    description: null,
    isLoading: false,
  });

  const openGuide = useCallback(async (path: string[]) => {
    setState(prev => ({
      ...prev,
      isOpen: true,
      currentPath: path,
      isLoading: true,
      content: null,
    }));

    try {
      const response = await fetch(`/api/guide/content?slug=${path.join('/')}`);
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          content: data.content,
          title: data.frontmatter?.title || null,
          description: data.frontmatter?.description || null,
          isLoading: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          content: null,
          title: 'Content Not Found',
          description: 'This documentation is coming soon.',
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error('Failed to load guide content:', error);
      setState(prev => ({
        ...prev,
        content: null,
        title: 'Error',
        description: 'Failed to load content. Please try again.',
        isLoading: false,
      }));
    }
  }, []);

  const closeGuide = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  return (
    <GuideContext.Provider value={{ ...state, openGuide, closeGuide }}>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuide() {
  const context = useContext(GuideContext);
  if (!context) {
    throw new Error('useGuide must be used within a GuideProvider');
  }
  return context;
}
