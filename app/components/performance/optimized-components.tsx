import React, { memo, useMemo } from "react";
import type { ReactNode } from "react";

/**
 * Optimized sidebar component to prevent unnecessary re-renders
 */
export const OptimizedSidebar = memo(function OptimizedSidebar({
  children,
  isOpen,
  organizationId,
}: {
  children: ReactNode;
  isOpen: boolean;
  organizationId: string;
}) {
  const memoizedChildren = useMemo(() => children, [organizationId]);
  
  return (
    <div 
      className={`transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      data-organization={organizationId}
    >
      {memoizedChildren}
    </div>
  );
});

/**
 * Optimized main content wrapper to reduce re-renders
 */
export const OptimizedMainContent = memo(function OptimizedMainContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={`min-h-screen transition-all duration-300 ${className}`}>
      {children}
    </main>
  );
});

/**
 * Optimized asset list item to prevent individual item re-renders
 */
export const OptimizedAssetListItem = memo(function OptimizedAssetListItem({
  asset,
  onSelect,
  isSelected,
}: {
  asset: any;
  onSelect: (id: string) => void;
  isSelected: boolean;
}) {
  const handleClick = useMemo(
    () => () => onSelect(asset.id),
    [onSelect, asset.id]
  );

  return (
    <div
      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
      }`}
      onClick={handleClick}
    >
      <h3 className="font-medium">{asset.title}</h3>
      {asset.description && (
        <p className="text-sm text-gray-600 mt-1">{asset.description}</p>
      )}
    </div>
  );
});

/**
 * Virtualized list for large asset collections
 */
export const VirtualizedAssetList = memo(function VirtualizedAssetList({
  assets,
  onAssetSelect,
  selectedAssets,
  itemHeight = 120,
}: {
  assets: any[];
  onAssetSelect: (id: string) => void;
  selectedAssets: Set<string>;
  itemHeight?: number;
}) {
  // For simplicity, render all items for now
  // In production, implement proper virtualization
  return (
    <div className="space-y-2">
      {assets.map((asset) => (
        <OptimizedAssetListItem
          key={asset.id}
          asset={asset}
          onSelect={onAssetSelect}
          isSelected={selectedAssets.has(asset.id)}
        />
      ))}
    </div>
  );
});

/**
 * Optimized search input with debouncing
 */
export const OptimizedSearchInput = memo(function OptimizedSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  debounceMs = 300,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}) {
  const [internalValue, setInternalValue] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (internalValue !== value) {
        onChange(internalValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [internalValue, onChange, debounceMs, value]);

  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  return (
    <input
      type="text"
      value={internalValue}
      onChange={(e) => setInternalValue(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
});

/**
 * Optimized filter component with memoization
 */
export const OptimizedFilterGroup = memo(function OptimizedFilterGroup({
  title,
  options,
  selectedValues,
  onSelectionChange,
}: {
  title: string;
  options: Array<{ id: string; name: string; count?: number }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
}) {
  const handleToggle = useMemo(
    () => (optionId: string) => {
      const newValues = selectedValues.includes(optionId)
        ? selectedValues.filter(id => id !== optionId)
        : [...selectedValues, optionId];
      onSelectionChange(newValues);
    },
    [selectedValues, onSelectionChange]
  );

  return (
    <div className="mb-6">
      <h3 className="font-medium mb-3">{title}</h3>
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.id} className="flex items-center">
            <input
              type="checkbox"
              checked={selectedValues.includes(option.id)}
              onChange={() => handleToggle(option.id)}
              className="mr-2"
            />
            <span className="text-sm">
              {option.name}
              {option.count !== undefined && (
                <span className="text-gray-500 ml-1">({option.count})</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
});

/**
 * Performance optimized table row component
 */
export const OptimizedTableRow = memo(function OptimizedTableRow({
  asset,
  columns,
  onRowClick,
}: {
  asset: any;
  columns: string[];
  onRowClick?: (asset: any) => void;
}) {
  const handleClick = useMemo(
    () => onRowClick ? () => onRowClick(asset) : undefined,
    [onRowClick, asset]
  );

  return (
    <tr 
      className="hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={handleClick}
    >
      {columns.map((column) => (
        <td key={column} className="px-4 py-3 text-sm">
          {asset[column] || '-'}
        </td>
      ))}
    </tr>
  );
});
