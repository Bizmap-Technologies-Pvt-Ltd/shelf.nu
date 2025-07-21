/**
 * RFID Asset Lookup Service for WebSocket Server
 * This module provides database access for the WebSocket server
 */

// Import the database client and asset service
const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const db = new PrismaClient();

// Add: Timeout helper for DB queries
function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('DB query timeout')), ms))
  ]);
}

/**
 * Look up an asset by RFID tag (with timeout)
 */
async function getAssetByRfid(rfid, organizationId = 'default-org') {
  try {
    if (!rfid || rfid.trim() === "") {
      return null;
    }
    // Normalize RFID tag: trim and convert to uppercase for consistency
    const normalizedRfid = rfid.trim().toUpperCase();
    
    const asset = await withTimeout(
      db.asset.findFirst({
        where: {
          rfid: {
            equals: normalizedRfid,
            mode: "insensitive"
          },
        },
        include: {
          category: true,
          location: true,
        },
      }),
      4000
    );
    return asset;
  } catch (error) {
    console.error('[DB] Error looking up asset by RFID:', error);
    return null;
  }
}

/**
 * Initialize the database connection with retry
 */
async function initializeDb(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await db.$connect();
      console.log('[DB] Database connection established');
      return true;
    } catch (error) {
      console.error(`[DB] Failed to connect (attempt ${i+1}):`, error);
      if (i === retries - 1) return false;
      await new Promise(res => setTimeout(res, 1000));
    }
  }
  return false;
}

/**
 * Close the database connection
 */
async function closeDb() {
  try {
    await db.$disconnect();
    console.log('[DB] Database connection closed');
  } catch (error) {
    console.error('[DB] Error closing database connection:', error);
  }
}

module.exports = {
  getAssetByRfid,
  initializeDb,
  closeDb
};
