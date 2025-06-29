// Script to create a test reconciliation bundle directly in the database
// Run with: node -r dotenv/config scripts/test-create-reconciliation-bundle.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv))
  .option('org', { type: 'string', describe: 'Organization ID' })
  .option('user', { type: 'string', describe: 'User ID' })
  .option('location', { type: 'string', describe: 'Location ID' })
  .help().argv;

// First, let's try to find valid IDs from the database to use

async function createTestBundle() {
  let org, user, location;
  try {
    if (argv.org && argv.user && argv.location) {
      org = { id: argv.org };
      user = { id: argv.user };
      location = { id: argv.location };
      console.log('Using IDs from CLI args');
    } else {
      console.log('Finding valid IDs from database...');
      
      // Get the first organization
      org = await prisma.organization.findFirst();
      if (!org) throw new Error('No organization found');
      
      // Get a user that belongs to this organization
      user = await prisma.user.findFirst({
        where: {
          organizations: {
            some: {
              organizationId: org.id
            }
          }
        }
      });
      if (!user) throw new Error('No user found');
      
      // Get a location for this organization
      location = await prisma.location.findFirst({
        where: {
          organizationId: org.id
        }
      });
      if (!location) throw new Error('No location found');
    }
    
    const testOrgId = org.id;
    const testUserId = user.id;
    const testLocationId = location.id;
    
    console.log(`Using organization: ${testOrgId}`);
    console.log(`Using user: ${testUserId}`);
    console.log(`Using location: ${testLocationId}`);
    
    console.log('Creating test reconciliation bundle...');
    
    const bundle = await prisma.reconciliationBundle.create({
      data: {
        bundleId: `REC-TEST-${Date.now()}`,
        date: new Date(),
        status: 'COMPLETED',
        locationId: testLocationId,
        userId: testUserId,
        organizationId: testOrgId,
        items: {
          create: [
            {
              rfidTag: 'TEST-RFID-TAG-1',
              assetId: null, // Null assetId to test handling
              assetName: 'Test Asset 1',
              category: 'Test Category',
              status: 'Available',
              location: 'Test Location'
            },
            {
              rfidTag: 'TEST-RFID-TAG-2',
              assetId: null, 
              assetName: 'Test Asset 2',
              category: 'Test Category',
              status: 'Available',
              location: 'Test Location'
            }
          ]
        }
      }
    });
    
    console.log('Successfully created test bundle:', bundle);
  } catch (error) {
    console.error('Error creating test bundle:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

createTestBundle();
