# RFID Asset Services

This documentation covers the new RFID-based asset fetching services that allow you to look up assets using RFID tags.

## Overview

The RFID services provide three main functions:
1. **Single RFID Lookup** - Find an asset by its RFID tag
2. **Batch RFID Lookup** - Find multiple assets by their RFID tags
3. **RFID Availability Check** - Check if an RFID tag is available or already in use

## Service Functions

### `getAssetByRfid()`

Fetches a single asset by its RFID tag.

```typescript
const asset = await getAssetByRfid({
  rfid: "RF123456789",
  organizationId: "org_123",
  userOrganizations: userOrgs, // Optional
  include: {
    category: true,
    location: true,
    tags: true,
    custody: {
      include: {
        custodian: { include: { user: true } }
      }
    },
    kit: true,
  }
});
```

**Parameters:**
- `rfid` (string): The RFID tag to search for
- `organizationId` (string): Current organization ID
- `userOrganizations` (optional): Array of organizations user has access to
- `include` (optional): Prisma include object for related data

**Returns:** `Asset | null`

### `getAssetsByRfidBatch()`

Fetches multiple assets by their RFID tags in a single query.

```typescript
const assets = await getAssetsByRfidBatch({
  rfidTags: ["RF123456789", "RF987654321", "RF555666777"],
  organizationId: "org_123",
  userOrganizations: userOrgs, // Optional
  include: {
    category: true,
    location: true,
    // ... other includes
  }
});
```

**Parameters:**
- `rfidTags` (string[]): Array of RFID tags to search for
- `organizationId` (string): Current organization ID
- `userOrganizations` (optional): Array of organizations user has access to
- `include` (optional): Prisma include object for related data

**Returns:** `Asset[]` (only assets with matching RFID tags)

### `checkRfidAvailability()`

Checks if an RFID tag is available for use or already assigned to an asset.

```typescript
const availability = await checkRfidAvailability({
  rfid: "RF123456789",
  organizationId: "org_123",
  excludeAssetId: "asset_456" // Optional - exclude specific asset from check
});

// Returns:
// {
//   isAvailable: false,
//   existingAsset: { id: "asset_123", title: "Laptop MacBook Pro" }
// }
```

**Parameters:**
- `rfid` (string): The RFID tag to check
- `organizationId` (string): Current organization ID
- `excludeAssetId` (optional): Asset ID to exclude from the check (useful for updates)

**Returns:** `{ isAvailable: boolean, existingAsset?: Asset }`

## API Routes

### GET `/api/assets/rfid`

**Single Asset Lookup:**
```
GET /api/assets/rfid?rfid=RF123456789
```

**Check Availability:**
```
GET /api/assets/rfid?rfid=RF123456789&action=check-availability&excludeAssetId=asset_123
```

### POST `/api/assets/rfid`

**Batch Lookup (JSON):**
```javascript
// Preferred method - supports JSON data with proper array handling
const response = await fetch("/api/assets/rfid", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    intent: "batch-lookup",
    rfidTags: ["RF123456789", "RF987654321", "RF555666777"]
  })
});

const result = await response.json();
const foundAssets = result.assets || [];
```

**Batch Lookup (FormData):**
```javascript
// Alternative method - FormData support maintained for compatibility
const formData = new FormData();
formData.append("intent", "batch-lookup");
formData.append("rfidTags", "RF123456789");
formData.append("rfidTags", "RF987654321");

fetch("/api/assets/rfid", {
  method: "POST",
  body: formData
});
```

**Single Lookup (POST):**
```javascript
const formData = new FormData();
formData.append("intent", "single-lookup");
formData.append("rfid", "RF123456789");

fetch("/api/assets/rfid", {
  method: "POST",
  body: formData
});
```

## Case-Insensitive RFID Handling

**Important**: All RFID operations are now case-insensitive to ensure maximum compatibility.

### Server-Side Implementation
```typescript
// Database queries use case-insensitive matching
where: {
  rfid: {
    in: validRfidTags,
    mode: 'insensitive'  // Prisma case-insensitive mode
  },
  organizationId
}
```

### Client-Side Implementation
```typescript
// Case-insensitive comparison in frontend
const foundAsset = foundAssets.find(asset => 
  asset.rfid.toLowerCase() === inputRfid.toLowerCase()
);

// Case-insensitive set operations
const foundRfidTags = new Set(
  foundAssets.map(asset => asset.rfid.toLowerCase())
);
```

### Benefits
- **Improved compatibility** with different RFID reader formats
- **Reduced lookup failures** due to case variations
- **Better user experience** - users don't need to worry about case
- **Legacy support** - works with existing RFID data in any case format

## Recent Improvements

### API Response Format
- **Fixed response parsing**: Changed from `result.data?.assets` to `result.assets`
- **Consistent format**: All endpoints now return `{ assets: [...], error: null }`
- **Better error handling**: Proper error objects with detailed messages

### Enhanced Debugging
- **Comprehensive logging**: Request/response tracking
- **RFID comparison debugging**: Step-by-step matching process logged
- **Performance monitoring**: Query timing and result counts

### Reconciliation Integration
- **Real database integration**: Replaced dummy data with actual asset lookups
- **Organization scoping**: Proper multi-tenant support
- **Permission enforcement**: Asset read permissions required

## React Hook: `useAssetRfid()`

A custom hook that provides easy access to RFID services with loading states and error handling.

```typescript
import { useAssetRfid } from "~/hooks/use-asset-rfid";

function MyComponent() {
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

  const handleLookup = async () => {
    const asset = await getAssetByRfid("RF123456789");
    if (asset) {
      console.log("Found asset:", asset.title);
    } else {
      console.log("No asset found");
    }
  };

  const handleBatchLookup = async () => {
    const assets = await getAssetsByRfidBatch([
      "RF123456789", 
      "RF987654321"
    ]);
    console.log(`Found ${assets.length} assets`);
  };

  const handleAvailabilityCheck = async () => {
    const result = await checkRfidAvailability("RF123456789");
    if (result.isAvailable) {
      console.log("RFID is available");
    } else {
      console.log("RFID already in use by:", result.existingAsset?.title);
    }
  };

  return (
    <div>
      <button onClick={handleLookup} disabled={isLoading}>
        {isLoading ? "Looking up..." : "Lookup Asset"}
      </button>
      
      <button onClick={handleBatchLookup} disabled={isBatchLoading}>
        {isBatchLoading ? "Processing..." : "Batch Lookup"}
      </button>
      
      <button onClick={handleAvailabilityCheck} disabled={isAvailabilityChecking}>
        {isAvailabilityChecking ? "Checking..." : "Check Availability"}
      </button>

      {error && <div className="error">{error}</div>}
      {batchError && <div className="error">{batchError}</div>}
      {availabilityError && <div className="error">{availabilityError}</div>}
    </div>
  );
}
```

## React Component: `RfidAssetLookup`

A pre-built component for RFID asset lookup with UI.

```typescript
import { RfidAssetLookup } from "~/components/assets/rfid-asset-lookup";

function MyPage() {
  const handleAssetFound = (asset) => {
    console.log("Asset found:", asset);
    // Handle the found asset (e.g., add to selection, navigate, etc.)
  };

  return (
    <RfidAssetLookup
      onAssetFound={handleAssetFound}
      placeholder="Scan or enter RFID tag..."
      showBatchLookup={true}
    />
  );
}
```

## Utility Functions

### `isValidRfidFormat(rfid: string): boolean`

Validates RFID tag format. Customize the validation rules based on your requirements.

```typescript
import { isValidRfidFormat } from "~/hooks/use-asset-rfid";

if (isValidRfidFormat("RF123456789")) {
  // Process the RFID
}
```

### `normalizeRfid(rfid: string): string`

Normalizes RFID tags by trimming whitespace and converting to uppercase.

```typescript
import { normalizeRfid } from "~/hooks/use-asset-rfid";

const normalized = normalizeRfid("  rf123456789  "); // Returns "RF123456789"
```

## Security & Permissions

All RFID services respect:
- **Organization isolation** - Users can only access assets from their organization(s)
- **Permission checks** - Requires `PermissionAction.read` on `PermissionEntity.asset`
- **Multi-organization support** - Users with access to multiple organizations can search across them

## Error Handling

The services include comprehensive error handling:
- **Validation errors** - Empty or invalid RFID tags
- **Not found** - When no asset matches the RFID
- **Permission errors** - When user lacks access
- **Database errors** - With proper error logging

## Performance Considerations

- **Single queries** are fast and efficient
- **Batch queries** use `findMany` with `IN` clause for optimal performance
- **Organization scoping** ensures queries are limited to relevant data
- **Selective includes** - Only load the data you need

## Usage Examples

### Basic Asset Lookup
```typescript
// Find an asset by RFID
const asset = await getAssetByRfid({
  rfid: "RF123456789",
  organizationId: currentOrg.id,
  include: { category: true, location: true }
});
```

### Inventory Reconciliation
```typescript
// Scan multiple RFID tags during inventory
const scannedRfids = ["RF001", "RF002", "RF003"];
const foundAssets = await getAssetsByRfidBatch({
  rfidTags: scannedRfids,
  organizationId: currentOrg.id,
  include: { category: true, location: true }
});

console.log(`Found ${foundAssets.length} of ${scannedRfids.length} assets`);
```

### Asset Assignment
```typescript
// Check if RFID is available before assigning to new asset
const availability = await checkRfidAvailability({
  rfid: "RF123456789",
  organizationId: currentOrg.id
});

if (availability.isAvailable) {
  // Safe to assign RFID to new asset
  await createAsset({ rfid: "RF123456789", /* other fields */ });
} else {
  // RFID already in use
  alert(`RFID already assigned to: ${availability.existingAsset?.title}`);
}
```

This RFID service provides a robust foundation for RFID-based asset management in your Bizmap application.
