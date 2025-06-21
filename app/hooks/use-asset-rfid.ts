import { useState, useCallback } from "react";
import { useFetcher } from "@remix-run/react";
import type { Asset, Category, Location, Tag, TeamMember, User, Kit, Custody, UserOrganization } from "@prisma/client";

// Types for the RFID services
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

type RfidAvailabilityResult = {
  isAvailable: boolean;
  existingAsset?: Pick<Asset, "id" | "title"> | null;
};

type UseAssetRfidResult = {
  // Single RFID lookup
  getAssetByRfid: (rfid: string) => Promise<AssetWithRfidData | null>;
  
  // Batch RFID lookup
  getAssetsByRfidBatch: (rfidTags: string[]) => Promise<AssetWithRfidData[]>;
  
  // Check RFID availability
  checkRfidAvailability: (rfid: string, excludeAssetId?: string) => Promise<RfidAvailabilityResult>;
  
  // Loading states
  isLoading: boolean;
  isBatchLoading: boolean;
  isAvailabilityChecking: boolean;
  
  // Error states
  error: string | null;
  batchError: string | null;
  availabilityError: string | null;
  
  // Clear errors
  clearErrors: () => void;
};

/**
 * Custom hook for managing RFID-based asset operations
 * Provides methods to fetch assets by RFID tags and check availability
 * @param organizationId - The current organization ID (optional, uses current session if not provided)
 * @param userOrganizations - Array of organizations the user has access to (optional)
 */
export function useAssetRfid(
  organizationId?: string, 
  userOrganizations?: Pick<UserOrganization, "organizationId">[]
): UseAssetRfidResult {
  const fetcher = useFetcher();
  const batchFetcher = useFetcher();
  const availabilityFetcher = useFetcher();
  
  const [error, setError] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const clearErrors = useCallback(() => {
    setError(null);
    setBatchError(null);
    setAvailabilityError(null);
  }, []);

  const getAssetByRfid = useCallback(async (rfid: string): Promise<AssetWithRfidData | null> => {
    if (!rfid || rfid.trim() === "") {
      setError("RFID tag cannot be empty");
      return null;
    }

    setError(null);
    
    try {
      const response = await fetch(`/api/assets/rfid?rfid=${encodeURIComponent(rfid.trim())}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to fetch asset by RFID");
      }
      
      return result.data?.asset || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      return null;
    }
  }, []);

  const getAssetsByRfidBatch = useCallback(async (rfidTags: string[]): Promise<AssetWithRfidData[]> => {
    if (!rfidTags || rfidTags.length === 0) {
      setBatchError("At least one RFID tag is required");
      return [];
    }

    // Filter out empty tags
    const validTags = rfidTags.filter(tag => tag && tag.trim() !== "");
    if (validTags.length === 0) {
      setBatchError("No valid RFID tags provided");
      return [];
    }

    setBatchError(null);

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("intent", "batch-lookup");
      validTags.forEach(tag => formData.append("rfidTags", tag.trim()));

      batchFetcher.submit(formData, {
        method: "POST",
        action: "/api/assets/rfid",
      });

      // Handle the response when fetcher completes
      const handleComplete = () => {
        if (batchFetcher.data) {
          const responseData = batchFetcher.data as any;
          if (responseData.error) {
            setBatchError(responseData.error.message);
            reject(new Error(responseData.error.message));
          } else {
            resolve(responseData.data?.assets || []);
          }
        }
      };

      // Set up a listener for when the fetcher completes
      const checkComplete = () => {
        if (batchFetcher.state === "idle" && batchFetcher.data) {
          handleComplete();
        } else {
          setTimeout(checkComplete, 100);
        }
      };
      checkComplete();
    });
  }, [batchFetcher]);

  const checkRfidAvailability = useCallback(async (
    rfid: string, 
    excludeAssetId?: string
  ): Promise<RfidAvailabilityResult> => {
    if (!rfid || rfid.trim() === "") {
      setAvailabilityError("RFID tag cannot be empty");
      return { isAvailable: false };
    }

    setAvailabilityError(null);
    
    try {
      const params = new URLSearchParams({
        rfid: rfid.trim(),
        action: "check-availability",
      });
      
      if (excludeAssetId) {
        params.append("excludeAssetId", excludeAssetId);
      }
      
      const response = await fetch(`/api/assets/rfid?${params.toString()}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to check RFID availability");
      }
      
      return result.data || { isAvailable: false };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setAvailabilityError(errorMessage);
      return { isAvailable: false };
    }
  }, []);

  return {
    getAssetByRfid,
    getAssetsByRfidBatch,
    checkRfidAvailability,
    isLoading: fetcher.state === "loading" || fetcher.state === "submitting",
    isBatchLoading: batchFetcher.state === "loading" || batchFetcher.state === "submitting",
    isAvailabilityChecking: availabilityFetcher.state === "loading" || availabilityFetcher.state === "submitting",
    error,
    batchError,
    availabilityError,
    clearErrors,
  };
}

/**
 * Utility function to validate RFID tag format
 * Add your specific RFID validation rules here
 */
export function isValidRfidFormat(rfid: string): boolean {
  if (!rfid || typeof rfid !== "string") {
    return false;
  }
  
  const trimmed = rfid.trim();
  
  // Basic validation - adjust based on your RFID format requirements
  return (
    trimmed.length > 0 && 
    trimmed.length <= 100 && // Reasonable max length
    !/\s/.test(trimmed) // No whitespace
  );
}

/**
 * Utility function to normalize RFID tags
 */
export function normalizeRfid(rfid: string): string {
  return rfid.trim().toUpperCase();
}
