'use client';

import { useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface ScrollingNavbarProps {
  children: ReactNode;
}

export default function ScrollingNavbar({ children }: ScrollingNavbarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const pathname = usePathname();

  // Marketing pages have their own navigation - hide the app navbar
  const marketingPages = ['/', '/pricing', '/about', '/auth/signup', '/auth/login'];
  const isMarketingPage = marketingPages.includes(pathname);

  useEffect(() => {
    // Don't add scroll listener on marketing pages
    if (isMarketingPage) return;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          // Always show navbar when at the top of the page
          if (currentScrollY < 10) {
            setIsVisible(true);
          }
          // Only hide/show if scrolled more than 5px to avoid jitter
          else if (Math.abs(currentScrollY - lastScrollY) > 5) {
            if (currentScrollY > lastScrollY && currentScrollY > 80) {
              // Scrolling down and past threshold
              setIsVisible(false);
            } else if (currentScrollY < lastScrollY) {
              // Scrolling up
              setIsVisible(true);
            }
            setLastScrollY(currentScrollY);
          }

          ticking = false;
        });

        ticking = true;
      }
    };

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY, isMarketingPage]);

  // Hide navbar on marketing pages - they have their own navigation
  if (isMarketingPage) {
    return null;
  }

  return (
    <nav
      className={`
        fixed top-0 left-0 right-0 z-50
        bg-white border-b border-gray-100
        transition-transform duration-300 ease-in-out
        ${isVisible ? 'translate-y-0' : '-translate-y-full'}
      `}
    >
      {children}
    </nav>
  );
}
