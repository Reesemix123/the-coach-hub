'use client';

import { useEffect, useRef, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  delay?: 0 | 1 | 2 | 3;
}

export function AnimateOnScroll({ children, className = '', delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('animate-in');
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const delays = ['', 'delay-100', 'delay-200', 'delay-300'];

  return (
    <div
      ref={ref}
      className={`opacity-0 translate-y-4 transition-all duration-700
        ease-out [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0
        ${delays[delay]} ${className}`}
    >
      {children}
    </div>
  );
}
