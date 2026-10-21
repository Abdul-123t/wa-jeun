import { useLayoutEffect, useRef, type ReactNode } from 'react';

const observedElements = new Map<Element, number>();
let sharedObserver: IntersectionObserver | null = null;

function stopObservingIfIdle() {
  if (observedElements.size === 0 && sharedObserver) {
    sharedObserver.disconnect();
    sharedObserver = null;
  }
}

function observeOnce(element: HTMLElement, delayMs: number) {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return () => {};

  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
    if (!sharedObserver) {
      sharedObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          const delay = observedElements.get(target) ?? 0;
          target.style.setProperty('--food-reveal-delay', `${delay}ms`);
          target.classList.remove('food-reveal-pending');
          target.classList.add('food-reveal-visible');
          observedElements.delete(target);
          sharedObserver?.unobserve(target);
        });
        stopObservingIfIdle();
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    }

    observedElements.set(element, Math.min(Math.max(delayMs, 0), 120));
    element.classList.add('food-reveal-pending');
    sharedObserver.observe(element);
  } catch {
    observedElements.delete(element);
    element.classList.remove('food-reveal-pending', 'food-reveal-visible');
    element.style.removeProperty('--food-reveal-delay');
    stopObservingIfIdle();
  }

  return () => {
    observedElements.delete(element);
    sharedObserver?.unobserve(element);
    element.classList.remove('food-reveal-pending', 'food-reveal-visible');
    element.style.removeProperty('--food-reveal-delay');
    stopObservingIfIdle();
  };
}

/** Progressive enhancement: content stays visible when observation is unavailable. */
export function ScrollReveal({ children, delayMs = 0, className = '' }: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    return element ? observeOnce(element, delayMs) : undefined;
  }, [delayMs]);

  return <div ref={ref} className={className}>{children}</div>;
}
