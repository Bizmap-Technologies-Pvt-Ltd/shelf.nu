import React, { Suspense, memo, useMemo, startTransition } from "react";
import type { ReactNode } from "react";

/**
 * Optimized loading wrapper for heavy components
 */
export const OptimizedLoadingWrapper = memo(function OptimizedLoadingWrapper({
  children,
  fallback = <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
});

/**
 * Optimized navigation wrapper that prevents re-renders
 */
export const OptimizedNavigation = memo(function OptimizedNavigation({
  children,
  currentPath,
}: {
  children: ReactNode;
  currentPath: string;
}) {
  const memoizedNav = useMemo(() => children, [currentPath]);
  
  return (
    <nav className="transition-all duration-200">
      {memoizedNav}
    </nav>
  );
});

/**
 * Fast transition wrapper for smooth navigation
 */
export function withFastTransition<T extends Record<string, any>>(
  Component: React.ComponentType<T>
) {
  return memo(function FastTransitionWrapper(props: T) {
    const memoizedProps = useMemo(() => props, Object.values(props));
    
    return (
      <OptimizedLoadingWrapper>
        <Component {...memoizedProps} />
      </OptimizedLoadingWrapper>
    );
  });
}

/**
 * Debounced search input for better performance
 */
export const OptimizedSearchInput = memo(function OptimizedSearchInput({
  onSearch,
  placeholder = "Search...",
  debounceMs = 300,
}: {
  onSearch: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}) {
  const [searchValue, setSearchValue] = React.useState("");
  
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      startTransition(() => {
        onSearch(searchValue);
      });
    }, debounceMs);
    
    return () => clearTimeout(timeout);
  }, [searchValue, onSearch, debounceMs]);
  
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={searchValue}
      onChange={(e) => setSearchValue(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
});

/**
 * Virtual scrolling for large lists
 */
export const VirtualizedList = memo(function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight = 60,
  containerHeight = 400,
}: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemHeight?: number;
  containerHeight?: number;
}) {
  const [scrollTop, setScrollTop] = React.useState(0);
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 2,
      items.length
    );
    
    return items.slice(startIndex, endIndex).map((item, i) => ({
      item,
      index: startIndex + i,
    }));
  }, [items, scrollTop, itemHeight, containerHeight]);
  
  return (
    <div
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: index * itemHeight,
              left: 0,
              right: 0,
              height: itemHeight,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * Optimized image component with lazy loading
 */
export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  className = "",
  fallback = "/default-asset.png",
}: {
  src?: string;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  
  return (
    <div className={`relative ${className}`}>
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
      )}
      <img
        src={error ? fallback : src || fallback}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-cover rounded transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
});
