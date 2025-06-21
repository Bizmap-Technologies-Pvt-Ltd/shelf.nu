import { useState } from "react";
import { useAssetRfid, isValidRfidFormat, normalizeRfid } from "~/hooks/use-asset-rfid";
import { Button } from "~/components/shared/button";
import Input from "~/components/forms/input";
import { Card } from "~/components/shared/card";
import { Badge } from "~/components/shared/badge";
import { Spinner } from "~/components/shared/spinner";
import { AssetImage } from "~/components/assets/asset-image/component";
import { AssetStatusBadge } from "~/components/assets/asset-status-badge";

interface RfidAssetLookupProps {
  onAssetFound?: (asset: any) => void;
  placeholder?: string;
  showBatchLookup?: boolean;
}

/**
 * Component for looking up assets by RFID tag
 * Supports both single and batch RFID lookups
 */
export function RfidAssetLookup({ 
  onAssetFound, 
  placeholder = "Enter RFID tag...",
  showBatchLookup = false 
}: RfidAssetLookupProps) {
  const [rfidInput, setRfidInput] = useState("");
  const [batchRfidInput, setBatchRfidInput] = useState("");
  const [foundAsset, setFoundAsset] = useState<any>(null);
  const [foundAssets, setFoundAssets] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any>(null);

  const {
    getAssetByRfid,
    getAssetsByRfidBatch,
    checkRfidAvailability,
    isLoading,
    isBatchLoading,
    isAvailabilityChecking,
    error,
    batchError,
    availabilityError,
    clearErrors,
  } = useAssetRfid();

  const handleSingleLookup = async () => {
    clearErrors();
    
    if (!rfidInput.trim()) {
      return;
    }

    if (!isValidRfidFormat(rfidInput)) {
      return;
    }

    const normalizedRfid = normalizeRfid(rfidInput);
    const asset = await getAssetByRfid(normalizedRfid);
    
    setFoundAsset(asset);
    if (asset && onAssetFound) {
      onAssetFound(asset);
    }
  };

  const handleBatchLookup = async () => {
    clearErrors();
    
    if (!batchRfidInput.trim()) {
      return;
    }

    // Split by comma, newline, or space
    const rfidTags = batchRfidInput
      .split(/[,\n\s]+/)
      .map(tag => tag.trim())
      .filter(tag => tag && isValidRfidFormat(tag))
      .map(tag => normalizeRfid(tag));

    if (rfidTags.length === 0) {
      return;
    }

    const assets = await getAssetsByRfidBatch(rfidTags);
    setFoundAssets(assets);
  };

  const handleCheckAvailability = async () => {
    clearErrors();
    
    if (!rfidInput.trim()) {
      return;
    }

    if (!isValidRfidFormat(rfidInput)) {
      return;
    }

    const normalizedRfid = normalizeRfid(rfidInput);
    const result = await checkRfidAvailability(normalizedRfid);
    setAvailability(result);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSingleLookup();
    }
  };

  return (
    <div className="space-y-6">
      {/* Single RFID Lookup */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Asset RFID Lookup</h3>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              value={rfidInput}
              onChange={(e) => setRfidInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="flex-1"
              disabled={isLoading}
              label=""
              name="rfid"
            />
            <Button
              onClick={handleSingleLookup}
              disabled={isLoading || !rfidInput.trim()}
              className="min-w-[100px]"
            >
              {isLoading ? <Spinner className="h-4 w-4" /> : "Lookup"}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleCheckAvailability}
              disabled={isAvailabilityChecking || !rfidInput.trim()}
              className="min-w-[140px]"
            >
              {isAvailabilityChecking ? (
                <Spinner className="h-4 w-4" />
              ) : (
                "Check Availability"
              )}
            </Button>
          </div>

          {/* Errors */}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {availabilityError && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
              {availabilityError}
            </div>
          )}

          {/* Availability Result */}
          {availability && (
            <div className="p-3 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <Badge
                  color={availability.isAvailable ? "success" : "error"}
                  className="font-medium"
                >
                  {availability.isAvailable ? "Available" : "In Use"}
                </Badge>
                <span className="text-sm text-gray-600">
                  RFID: {rfidInput}
                </span>
              </div>
              {availability.existingAsset && (
                <div className="mt-2 text-sm text-gray-600">
                  Currently used by: <strong>{availability.existingAsset.title}</strong>
                </div>
              )}
            </div>
          )}

          {/* Single Asset Result */}
          {foundAsset && (
            <AssetCard asset={foundAsset} />
          )}

          {/* No asset found message */}
          {foundAsset === null && rfidInput && !isLoading && !error && (
            <div className="text-gray-500 text-sm p-3 bg-gray-50 rounded">
              No asset found with RFID: {rfidInput}
            </div>
          )}
        </div>
      </Card>

      {/* Batch RFID Lookup */}
      {showBatchLookup && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Batch RFID Lookup</h3>
          
          <div className="space-y-4">
            <div>
              <textarea
                value={batchRfidInput}
                onChange={(e) => setBatchRfidInput(e.target.value)}
                placeholder="Enter multiple RFID tags (separated by commas, spaces, or new lines)..."
                className="w-full p-2 border border-gray-300 rounded-md min-h-[100px]"
                disabled={isBatchLoading}
              />
            </div>

            <Button
              onClick={handleBatchLookup}
              disabled={isBatchLoading || !batchRfidInput.trim()}
              className="min-w-[120px]"
            >
              {isBatchLoading ? <Spinner className="h-4 w-4" /> : "Batch Lookup"}
            </Button>

            {batchError && (
              <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                {batchError}
              </div>
            )}

            {/* Batch Results */}
            {foundAssets.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">Found {foundAssets.length} assets:</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {foundAssets.map((asset) => (
                    <AssetCard key={asset.id} asset={asset} compact />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Asset card component for displaying found assets
 */
function AssetCard({ asset, compact = false }: { asset: any; compact?: boolean }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AssetImage
            asset={{
              id: asset.id,
              mainImage: asset.mainImage,
              thumbnailImage: asset.thumbnailImage,
              mainImageExpiration: asset.mainImageExpiration,
            }}
            alt={asset.title || "Asset image"}
            className={compact ? "h-12 w-12" : "h-16 w-16"}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900 truncate">
                {asset.title}
              </h4>
              <p className="text-sm text-gray-500">RFID: {asset.rfid}</p>
            </div>
            <AssetStatusBadge 
              status={asset.status} 
              availableToBook={asset.availableToBook || false}
            />
          </div>
          
          <div className="mt-2 space-y-1">
            {asset.category && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Category:</span>
                <Badge color={asset.category.color || "gray"} className="text-xs">
                  {asset.category.name}
                </Badge>
              </div>
            )}
            
            {asset.location && (
              <div className="text-xs text-gray-500">
                Location: {asset.location.name}
              </div>
            )}
            
            {asset.custody && (
              <div className="text-xs text-gray-500">
                Custodian: {asset.custody.custodian.name}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
