import React, { memo } from "react";

/**
 * Higher-order component to optimize re-renders for heavy components
 */
export function withPerformanceOptimization<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  areEqual?: (prevProps: T, nextProps: T) => boolean
) {
  const MemoizedComponent = memo(Component, areEqual);
  MemoizedComponent.displayName = `Optimized(${Component.displayName || Component.name})`;
  return MemoizedComponent;
}

/**
 * Hook to debounce search queries to reduce API calls
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Virtual scrolling hook for large lists
 */
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const [visibleItems, setVisibleItems] = React.useState<{
    startIndex: number;
    endIndex: number;
    items: T[];
  }>({ startIndex: 0, endIndex: 0, items: [] });

  React.useEffect(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );

    setVisibleItems({
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex),
    });
  }, [scrollTop, itemHeight, containerHeight, items]);

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    handleScroll,
    totalHeight: items.length * itemHeight,
    offsetY: visibleItems.startIndex * itemHeight,
  };
}

/**
 * Performance monitor component for development
 */
export function PerformanceMonitor({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "development") {
    return <>{children}</>;
  }

  return (
    <React.Profiler
      id="app"
      onRender={(id, phase, actualDuration) => {
        if (actualDuration > 16) { // Slower than 60fps
          console.warn(`🐌 Slow render detected: ${id} (${phase}) took ${actualDuration.toFixed(2)}ms`);
        }
      }}
    >
      {children}
    </React.Profiler>
  );
}

/**
 * Lazy loading wrapper for heavy components
 */
export function LazyWrapper({ 
  children, 
  fallback = <div>Loading...</div>,
  threshold = "0px"
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: string;
}) {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
}

/**
 * Prevent unnecessary re-renders for expensive calculations
 */
export function useExpensiveMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  const memoizedValue = React.useMemo(factory, deps);
  return memoizedValue;
}

/**
 * Optimize callback functions to prevent re-renders
 */
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return React.useCallback(callback, deps);
}
