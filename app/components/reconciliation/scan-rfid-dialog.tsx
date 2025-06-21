import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/shared/modal";
import { Button } from "~/components/shared/button";
import { useState, useEffect } from "react";
import { useSetAtom } from "jotai";
import { scannedItemsAtom, type ScannedRfidItem } from "~/atoms/rfid-scanner";
import { AssetReconciliationTable, type AssetReconciliationItem } from "./asset-reconciliation-table";
import { XIcon, PlusIcon, LoaderIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Asset, Category, Location, Tag, TeamMember, User, Kit, Custody, UserOrganization } from "@prisma/client";

// Type for asset data returned from RFID service
type AssetWithRfidData = Asset & {
  category?: Category | null;
  location?: Location | null;
  tags?: Tag[];
  custody?: (Custody & {
    custodian: TeamMember & {
      user: User;
    };
  }) | null;
  kit?: Kit | null;
  rfid: string;
};

type ManualEntry = {
  id: string;
  rfidTag: string;
  assetName: string;
  category: string;
  status: string;
  location: string;
};

export function ScanRfidDialog({
  isOpen,
  onClose,
  onSave,
  organizationId,
  userOrganizations,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: ScannedRfidItem[]) => void;
  organizationId: string;
  userOrganizations?: Pick<UserOrganization, "organizationId">[];
}) {
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [scannedItems, setScannedItems] = useState<AssetReconciliationItem[]>([]);
  const [assetDataMap, setAssetDataMap] = useState<Map<string, AssetWithRfidData>>(new Map());
  const [showScannedPreview, setShowScannedPreview] = useState(false);
  const [isAddingMore, setIsAddingMore] = useState(false);
  const [hasNewEntries, setHasNewEntries] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [fetchProgressMessage, setFetchProgressMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const setGlobalScannedItems = useSetAtom(scannedItemsAtom);
  
  // No pagination needed for mobile - show all entries in a scrollable view
  const ROWS_PER_PAGE = 5; // Keep for desktop compatibility
  const totalPages = Math.ceil(manualEntries.length / ROWS_PER_PAGE);

  // Initialize rows function
  const createInitialRows = () => Array.from({ length: 10 }, (_, i) => ({
    id: (i + 1).toString().padStart(2, '0'),
    rfidTag: "",
    assetName: "",
    category: "",
    status: "",
    location: "",
  }));

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setManualEntries(createInitialRows());
      setScannedItems([]);
      setAssetDataMap(new Map());
      setShowScannedPreview(false);
      setIsAddingMore(false);
      setHasNewEntries(false);
      setIsFetching(false);
      setFetchProgress(0);
      setFetchProgressMessage("");
      setCurrentPage(0);
      setFetchError(null);
    }
  }, [isOpen]);

  // Initialize state on first open
  useEffect(() => {
    if (isOpen && manualEntries.length === 0) {
      setManualEntries(createInitialRows());
    }
  }, [isOpen]);

  const updateRfidTag = (id: string, value: string) => {
    // Check if user is entering new RFID tags after having scanned items
    if (scannedItems.length > 0 && value.trim() && !hasNewEntries) {
      setHasNewEntries(true);
    }

    setManualEntries(prev => {
      // 1. Check if this RFID tag already exists in scanned items
      const isDuplicate = value.trim() && scannedItems.some(item => 
        item.rfidTag.toLowerCase() === value.trim().toLowerCase()
      );

      // 2. Update the value on the edited row
      const updated = prev.map(entry => {
        if (entry.id === id) {
          if (isDuplicate) {
            return {
              ...entry,
              rfidTag: value,
              assetName: "Already Scanned",
              category: "Duplicate",
              status: "Duplicate",
              location: "Duplicate",
            };
          } else {
            return {
              ...entry,
              rfidTag: value,
              // Reset other fields when RFID changes (they'll be populated after fetch)
              assetName: value.trim() ? "" : "",
              category: value.trim() ? "" : "",
              status: value.trim() ? "" : "",
              location: value.trim() ? "" : "",
            };
          }
        }
        return entry;
      });

      // 3. Find the current entry index
      const currentIndex = prev.findIndex(entry => entry.id === id);
      
      // 4. If this is one of the last 3 rows and has a value, add 5 more rows
      if (currentIndex >= prev.length - 3 && value.trim()) {
        const moreRows = Array.from({ length: 5 }, (_, i) => {
          const idx = prev.length + i + 1;
          return {
            id: idx.toString().padStart(2, '0'),
            rfidTag: "",
            assetName: "",
            category: "",
            status: "",
            location: "",
          };
        });
        
        return [...updated, ...moreRows];
      }

      return updated;
    });
  };

  const convertAssetToReconciliationItem = (asset: AssetWithRfidData): AssetReconciliationItem => {
    return {
      rfidTag: asset.rfid,
      assetId: asset.id,
      assetName: asset.title,
      category: asset.category?.name || "Uncategorized",
      status: asset.status === "AVAILABLE" ? "Available" : "In Use",
      location: asset.location?.name || "No Location",
    };
  };

  const fetchAssets = async () => {
    setIsFetching(true);
    setFetchProgress(0);
    setFetchProgressMessage("Preparing...");
    setFetchError(null);

    const validEntries = manualEntries.filter(entry => entry.rfidTag.trim());
    const rfidTags = validEntries.map(entry => entry.rfidTag.trim());

    if (rfidTags.length === 0) {
      setIsFetching(false);
      return;
    }

    // Filter out RFID tags that are already in our scanned items (for resume functionality)
    const existingRfidTags = new Set(scannedItems.map(item => item.rfidTag.toLowerCase()));
    const newRfidTags = rfidTags.filter(tag => !existingRfidTags.has(tag.toLowerCase()));
    
    if (newRfidTags.length === 0 && scannedItems.length > 0) {
      setFetchError("All entered RFID tags have already been scanned. Please add new RFID tags.");
      setIsFetching(false);
      return;
    }

    // Only fetch tags that are truly new (not already scanned)
    const tagsToFetch = newRfidTags;
    
    if (tagsToFetch.length === 0) {
      setFetchError("No new RFID tags to fetch.");
      setIsFetching(false);
      return;
    }

    try {
      // Step 1: Preparing request (10%)
      setFetchProgress(10);
      setFetchProgressMessage("Preparing request...");
      
      // Step 2: Sending request (20%)
      setFetchProgress(20);
      setFetchProgressMessage("Sending request...");
      
      // Send JSON data instead of FormData to properly handle arrays
      const response = await fetch("/api/assets/rfid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "batch-lookup",
          rfidTags: tagsToFetch,
        }),
      });

      // Step 3: Request sent, waiting for response (40%)
      setFetchProgress(40);
      setFetchProgressMessage("Waiting for server response...");

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error?.message || `Request failed with status ${response.status}`);
      }

      // Step 4: Processing response (60%)
      setFetchProgress(60);
      setFetchProgressMessage("Processing response...");
      
      const result = await response.json();
      const foundAssets: AssetWithRfidData[] = result.assets || [];
      
      // Step 5: Processing assets (80%)
      setFetchProgress(80);
      setFetchProgressMessage("Processing asset data...");
      
      // Convert found assets to reconciliation items and store asset data
      const newReconciliationItems: AssetReconciliationItem[] = [];
      const foundRfidTags = new Set(foundAssets.map(asset => asset.rfid.toLowerCase()));
      const newAssetMap = new Map<string, AssetWithRfidData>();

      // Process found assets
      foundAssets.forEach(asset => {
        const reconciliationItem = convertAssetToReconciliationItem(asset);
        newReconciliationItems.push(reconciliationItem);
        newAssetMap.set(asset.rfid.toLowerCase(), asset);
      });

      // Handle missing assets (RFIDs that weren't found)
      tagsToFetch.forEach(rfid => {
        if (!foundRfidTags.has(rfid.toLowerCase())) {
          newReconciliationItems.push({
            rfidTag: rfid,
            assetId: "unknown",
            assetName: "Asset Not Found",
            category: "Unknown",
            status: "Unknown",
            location: "Unknown",
          });
        }
      });

      // Step 6: Updating UI (95%)
      setFetchProgress(95);
      setFetchProgressMessage("Updating interface...");
      
      // CRITICAL FIX: Properly merge with existing scanned items
      // Don't replace existing scanned items, only append new ones
      const allReconciliationItems = [...scannedItems, ...newReconciliationItems];
      const mergedAssetMap = new Map([...assetDataMap, ...newAssetMap]);
      
      // Update scanned items and asset data map
      setScannedItems(allReconciliationItems);
      setAssetDataMap(mergedAssetMap);
      
      // Update manual entries with found asset data
      setManualEntries(prev => {
        const updated = prev.map(entry => {
          if (!entry.rfidTag.trim()) return entry;
          
          // Check if this RFID was found in the current fetch
          const foundAsset = foundAssets.find(asset => {
            return asset.rfid.toLowerCase() === entry.rfidTag.trim().toLowerCase();
          });
          
          if (foundAsset) {
            return {
              ...entry,
              assetName: foundAsset.title,
              category: foundAsset.category?.name || "Uncategorized",
              status: foundAsset.status === "AVAILABLE" ? "Available" : "In Use",
              location: foundAsset.location?.name || "No Location",
            };
          } else {
            // Only mark as "Asset Not Found" if it was in the tags we fetched
            if (tagsToFetch.some(tag => tag.toLowerCase() === entry.rfidTag.trim().toLowerCase())) {
              return {
                ...entry,
                assetName: "Asset Not Found",
                category: "Unknown",
                status: "Unknown",
                location: "Unknown",
              };
            }
            // If it wasn't in the fetch, keep the existing data unchanged
            return entry;
          }
        });
        
        return updated;
      });

      // Step 7: Complete (100%)
      setFetchProgress(100);
      setFetchProgressMessage("Complete!");
      
      // Reset adding more state and new entries flag after successful fetch
      setIsAddingMore(false);
      setHasNewEntries(false);
      
      // Small delay to show completion before hiding
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch assets";
      setFetchError(errorMessage);
      console.error("Error fetching assets by RFID:", error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSaveBundle = () => {
    const items: ScannedRfidItem[] = scannedItems.map(item => {
      const assetData = assetDataMap.get(item.rfidTag.toLowerCase());
      
      return {
        rfid: item.rfidTag,
        asset: assetData ? {
          id: assetData.id,
          title: assetData.title,
          category: assetData.category?.name || "Uncategorized",
          status: assetData.status === "AVAILABLE" ? "Available" : "In Use",
          location: assetData.location?.name || "No Location",
        } : {
          id: "unknown",
          title: item.assetName,
          category: item.category,
          status: item.status,
          location: item.location,
        },
      };
    });

    onSave(items);
    setGlobalScannedItems(items);
    setScannedItems([]);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="w-[95vw] max-w-4xl h-[90vh] max-h-[800px] p-0 overflow-hidden">
        <AlertDialogHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1">
              <AlertDialogTitle className="text-lg sm:text-xl">
                {scannedItems.length > 0 && !hasNewEntries 
                  ? `Assets Scanned (${scannedItems.length})` 
                  : hasNewEntries 
                  ? "Add More RFID Tags" 
                  : "Scan RFID Tags"
                }
              </AlertDialogTitle>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {scannedItems.length > 0 && !hasNewEntries
                  ? "Assets successfully scanned and ready to save."
                  : hasNewEntries 
                  ? "Enter additional RFID tags to add to your current bundle"
                  : "Place RFID tags within range of the scanner"
                }
              </p>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="flex-1 overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
          <div className="space-y-3 sm:space-y-4 h-full flex flex-col">
            
            {/* Desktop Table View */}
            <div className="hidden md:block flex-1 overflow-hidden">
              <div className="border rounded-lg overflow-hidden bg-white h-full flex flex-col">
                <div className="flex-1 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="w-16 px-3 py-2 text-left text-xs font-medium text-gray-500 border-b border-r">S.No</th>
                        <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 border-b border-r">RFID Tag</th>
                        <th className="min-w-[180px] px-3 py-2 text-left text-xs font-medium text-gray-500 border-b border-r">Asset Name</th>
                        <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 border-b border-r">Category</th>
                        <th className="w-28 px-3 py-2 text-left text-xs font-medium text-gray-500 border-b border-r">Status</th>
                        <th className="min-w-[140px] px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualEntries.map((entry, index) => (
                        <tr key={entry.id} className="border-b hover:bg-gray-50 h-10">
                          <td className="px-3 py-2 text-xs text-gray-500 border-r">{entry.id}</td>
                          <td className="px-1 py-1 border-r">
                            <input
                              type="text"
                              value={entry.rfidTag}
                              onChange={(e) => updateRfidTag(entry.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && index < manualEntries.length - 1) {
                                  const nextInput = document.querySelector(`input[data-row="${index + 1}"]`) as HTMLInputElement;
                                  if (nextInput) nextInput.focus();
                                }
                              }}
                              data-row={index}
                              placeholder="Enter RFID"
                              className="w-full px-2 py-1 text-xs border-0 focus:ring-1 focus:ring-orange-500 focus:outline-none rounded"
                              disabled={isFetching}
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500 border-r">
                            <div className="truncate" title={entry.assetName}>
                              {entry.assetName || "-"}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500 border-r">
                            <div className="truncate" title={entry.category}>
                              {entry.category || "-"}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500 border-r">
                            {entry.status ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                entry.status === 'Available' ? 'bg-green-100 text-green-800' : 
                                entry.status === 'In Use' ? 'bg-yellow-100 text-yellow-800' :
                                entry.status === 'Duplicate' ? 'bg-blue-100 text-blue-800' :
                                entry.status === 'Unknown' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {entry.status}
                              </span>
                            ) : "-"}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            <div className="truncate" title={entry.location}>
                              {entry.location || "-"}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>            {/* Mobile Card View - Continuous Scroll */}
            <div className="md:hidden flex-1 overflow-hidden">
              <div className="h-full overflow-auto space-y-3 pb-4">
                {manualEntries.map((entry, index) => (
                  <div key={entry.id} className="bg-white border rounded-lg p-4 space-y-3 transition-all duration-200 hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">#{entry.id}</span>
                      {entry.status && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          entry.status === 'Available' ? 'bg-green-100 text-green-800' : 
                          entry.status === 'In Use' ? 'bg-yellow-100 text-yellow-800' :
                          entry.status === 'Duplicate' ? 'bg-blue-100 text-blue-800' :
                          entry.status === 'Unknown' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {entry.status}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">RFID Tag</label>
                        <input
                          type="text"
                          value={entry.rfidTag}
                          onChange={(e) => updateRfidTag(entry.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              // Move to next input smoothly
                              if (index < manualEntries.length - 1) {
                                setTimeout(() => {
                                  const nextInput = document.querySelector(`input[data-mobile-row="${index + 1}"]`) as HTMLInputElement;
                                  if (nextInput) {
                                    nextInput.focus();
                                    // Smooth scroll to the next input
                                    nextInput.scrollIntoView({ 
                                      behavior: 'smooth', 
                                      block: 'center',
                                      inline: 'nearest'
                                    });
                                  }
                                }, 50);
                              }
                            }
                          }}
                          data-mobile-row={index}
                          placeholder="Enter RFID"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                          disabled={isFetching}
                        />
                      </div>
                      
                      {(entry.assetName || entry.category || entry.location) && (
                        <div className="grid grid-cols-1 gap-2 pt-2 border-t animate-in slide-in-from-top duration-300">
                          {entry.assetName && (
                            <div className="flex flex-wrap">
                              <span className="text-xs text-gray-500 min-w-[60px]">Asset: </span>
                              <span className="text-sm text-gray-900 font-medium">{entry.assetName}</span>
                            </div>
                          )}
                          {entry.category && (
                            <div className="flex flex-wrap">
                              <span className="text-xs text-gray-500 min-w-[60px]">Category: </span>
                              <span className="text-sm text-gray-900">{entry.category}</span>
                            </div>
                          )}
                          {entry.location && (
                            <div className="flex flex-wrap">
                              <span className="text-xs text-gray-500 min-w-[60px]">Location: </span>
                              <span className="text-sm text-gray-900">{entry.location}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Loading indicator for new rows */}
                {manualEntries.length > 10 && (
                  <div className="text-center py-2">
                    <span className="text-xs text-gray-400">
                      {manualEntries.length} rows available
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Scanned Items Summary */}
            {scannedItems.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium">
                      {scannedItems.length} asset{scannedItems.length === 1 ? '' : 's'} scanned successfully
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowScannedPreview(!showScannedPreview)}
                    className="text-xs text-green-600 hover:text-green-800 h-6 px-2"
                  >
                    {showScannedPreview ? 'Hide Details' : 'View Details'}
                  </Button>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  You can save this bundle or resume scanning to add more items.
                </p>
                {showScannedPreview && (
                  <div className="mt-3 border-t border-green-200 pt-3">
                    <div className="text-xs font-medium text-green-700 mb-2">Scanned Assets:</div>
                    <div className="max-h-40 overflow-auto">
                      <AssetReconciliationTable items={scannedItems} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fetch Progress */}
            {isFetching && (
              <div className="space-y-2 bg-orange-50 p-3 rounded-lg">
                <div className="flex items-center justify-between text-sm text-orange-700">
                  <div className="flex items-center gap-2">
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                    <span>{fetchProgressMessage || "Fetching assets..."}</span>
                  </div>
                  <span className="font-medium">{fetchProgress}%</span>
                </div>
                <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-300 ease-out"
                    style={{ width: `${fetchProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Display */}
            {fetchError && (
              <div className="space-y-2 bg-red-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <XIcon className="h-4 w-4" />
                  Error fetching assets: {fetchError}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFetchError(null)}
                  className="text-xs"
                >
                  Dismiss
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t">
              {!isFetching ? (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onClose}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  
                  {/* Show Fetch button when: no items scanned OR user has entered new RFID tags */}
                  {(scannedItems.length === 0 || hasNewEntries) && (
                    <Button
                      size="sm"
                      onClick={fetchAssets}
                      disabled={!manualEntries.some(e => e.rfidTag.trim())}
                      className="w-full sm:w-auto"
                    >
                      {scannedItems.length === 0 ? "Fetch Assets" : "Fetch New Assets"}
                    </Button>
                  )}
                  
                  {/* Show Save Bundle button when items are scanned and no new entries */}
                  {scannedItems.length > 0 && !hasNewEntries && (
                    <Button 
                      size="sm" 
                      onClick={handleSaveBundle} 
                      className="hover:bg-orange-600 w-full sm:w-auto"
                    >
                      <span className="hidden sm:inline">Save Bundle ({scannedItems.length})</span>
                      <span className="sm:hidden">Save ({scannedItems.length})</span>
                    </Button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}