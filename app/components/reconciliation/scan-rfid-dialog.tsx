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
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
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
      setIsFetching(false);
      setFetchProgress(0);
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
    setManualEntries(prev => {
      // 1. Update the value on the edited row
      const updated = prev.map(entry =>
        entry.id === id ? { ...entry, rfidTag: value } : entry
      );

      // 2. Find the current entry index
      const currentIndex = prev.findIndex(entry => entry.id === id);
      
      // 3. If this is one of the last 3 rows and has a value, add 5 more rows
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
      assetName: asset.title,
      category: asset.category?.name || "Uncategorized",
      status: asset.status === "AVAILABLE" ? "Available" : "In Use",
      location: asset.location?.name || "No Location",
    };
  };

  const fetchAssets = async () => {
    setIsFetching(true);
    setFetchProgress(0);
    setFetchError(null);

    const validEntries = manualEntries.filter(entry => entry.rfidTag.trim());
    const rfidTags = validEntries.map(entry => entry.rfidTag.trim());

    if (rfidTags.length === 0) {
      setIsFetching(false);
      return;
    }

    try {
      console.log("Fetching assets for RFID tags:", rfidTags);
      
      // Send JSON data instead of FormData to properly handle arrays
      const response = await fetch("/api/assets/rfid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "batch-lookup",
          rfidTags: rfidTags,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error?.message || `Request failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log("API Response:", result);
      const foundAssets: AssetWithRfidData[] = result.assets || [];
      console.log("Found assets:", foundAssets);
      
      // Convert found assets to reconciliation items
      const reconciliationItems: AssetReconciliationItem[] = [];
      const foundRfidTags = new Set(foundAssets.map(asset => asset.rfid.toLowerCase()));

      // Process found assets
      foundAssets.forEach(asset => {
        const reconciliationItem = convertAssetToReconciliationItem(asset);
        reconciliationItems.push(reconciliationItem);
      });

      // Handle missing assets (RFIDs that weren't found)
      rfidTags.forEach(rfid => {
        if (!foundRfidTags.has(rfid.toLowerCase())) {
          reconciliationItems.push({
            rfidTag: rfid,
            assetName: "Asset Not Found",
            category: "Unknown",
            status: "Unknown",
            location: "Unknown",
          });
        }
      });

      // Update both scanned items and manual entries
      setScannedItems(reconciliationItems);
      
      // Update manual entries with found asset data
      console.log("Updating manual entries. Current entries:", manualEntries);
      console.log("Found assets for update:", foundAssets);
      
      setManualEntries(prev => {
        const updated = prev.map(entry => {
          if (!entry.rfidTag.trim()) return entry;
          
          console.log(`Looking for asset with RFID: "${entry.rfidTag.trim()}" (lowercase: "${entry.rfidTag.trim().toLowerCase()}")`);
          const foundAsset = foundAssets.find(asset => {
            console.log(`Comparing with asset RFID: "${asset.rfid}" (lowercase: "${asset.rfid.toLowerCase()}")`);
            return asset.rfid.toLowerCase() === entry.rfidTag.trim().toLowerCase();
          });
          
          if (foundAsset) {
            console.log(`Found matching asset for RFID ${entry.rfidTag}: ${foundAsset.title}`);
            return {
              ...entry,
              assetName: foundAsset.title,
              category: foundAsset.category?.name || "Uncategorized",
              status: foundAsset.status === "AVAILABLE" ? "Available" : "In Use",
              location: foundAsset.location?.name || "No Location",
            };
          } else {
            console.log(`No matching asset found for RFID ${entry.rfidTag}`);
            return {
              ...entry,
              assetName: "Asset Not Found",
              category: "Unknown",
              status: "Unknown",
              location: "Unknown",
            };
          }
        });
        
        console.log("Updated manual entries:", updated);
        return updated;
      });

      setFetchProgress(100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch assets";
      setFetchError(errorMessage);
      console.error("Error fetching assets by RFID:", error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSaveBundle = () => {
    const items: ScannedRfidItem[] = scannedItems.map(item => ({
      rfid: item.rfidTag,
      asset: {
        id: item.rfidTag,
        title: item.assetName,
        category: item.category,
        status: item.status,
        location: item.location,
      },
    }));

    onSave(items);
    setGlobalScannedItems(items);
    setScannedItems([]);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="w-[95vw] max-w-4xl h-[90vh] max-h-[800px] p-0 overflow-hidden">
        <AlertDialogHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b">
          <AlertDialogTitle className="text-lg sm:text-xl">Manual RFID Entry</AlertDialogTitle>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Enter RFID tags and press Enter to move to next row
          </p>
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
                              className="w-full px-2 py-1 text-xs border-0 focus:ring-1 focus:ring-blue-500 focus:outline-none rounded"
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
                            {entry.status ? (                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          entry.status === 'Available' ? 'bg-green-100 text-green-800' : 
                          entry.status === 'In Use' ? 'bg-yellow-100 text-yellow-800' :
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
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
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

            {/* Fetch Progress */}
            {isFetching && (
              <div className="space-y-2 bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                  Fetching assets... {fetchProgress}%
                </div>
                <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300 ease-out"
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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onClose}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              {!isFetching && scannedItems.length === 0 ? (
                <Button
                  size="sm"
                  onClick={fetchAssets}
                  disabled={!manualEntries.some(e => e.rfidTag.trim())}
                  className="w-full sm:w-auto order-1 sm:order-2"
                >
                  Fetch Assets
                </Button>
              ) : scannedItems.length > 0 ? (
                <Button 
                  size="sm" 
                  onClick={handleSaveBundle} 
                  className="bg-green-500 hover:bg-green-600 w-full sm:w-auto order-1 sm:order-2"
                >
                  Save Bundle ({scannedItems.length} items)
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}