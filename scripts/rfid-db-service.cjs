/**
 * RFID Asset Lookup Service for WebSocket Server
 * This module provides database access for the WebSocket server
 */

// Import the database client and asset service
const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const db = new PrismaClient();

/**
 * Look up an asset by RFID tag
 * Simplified version for WebSocket use
 */
async function getAssetByRfid(rfid, organizationId = 'default-org') {
  try {
    if (!rfid || rfid.trim() === "") {
      return null;
    }

    const asset = await db.asset.findFirst({
      where: {
        rfid: {
          equals: rfid.trim(),
          mode: "insensitive"
        },
        // For development, we'll check all organizations or use a default
        // In production, this should be properly scoped
      },
      include: {
        category: true,
        location: true,
      },
    });

    return asset;
  } catch (error) {
    console.error('[DB] Error looking up asset by RFID:', error);
    return null;
  }
}

/**
 * Initialize the database connection
 */
async function initializeDb() {
  try {
    await db.$connect();
    console.log('[DB] Database connection established');
    return true;
  } catch (error) {
    console.error('[DB] Failed to connect to database:', error);
    return false;
  }
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
