// Test script to create a sample reconciliation bundle
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createSampleBundle() {
  try {
    // Replace these with valid IDs from your environment
    const organizationId = '879adde4-6f2d-4a01-9c5a-2ed8890637cd';
    const userId = '1a6b0e0c-b980-4320-8124-9dcfc03acf7b';
    const locationId = 'cmc3l187q001sfbzwetuxiaqg'; // Bhopal Mac Storage
    
    console.log('Creating sample bundle...');
    
    const bundle = await prisma.reconciliationBundle.create({
      data: {
        bundleId: `REC-SAMPLE-${Date.now()}`,
        date: new Date(),
        status: 'COMPLETED',
        organizationId,
        userId,
        locationId,
        items: {
          create: [
            {
              rfidTag: 'E2004F38E59FE50A66E22A01',
              assetId: null,
              assetName: 'Test iPhone',
              category: 'Phone',
              status: 'Available',
              location: 'Bhopal Mac Storage'
            },
            {
              rfidTag: 'E2004F38E59FE50A66E22A02',
              assetId: null,
              assetName: 'Test MacBook',
              category: 'Laptop',
              status: 'Available',
              location: 'Bhopal Mac Storage'
            }
          ]
        }
      }
    });
    
    console.log('Successfully created sample bundle:', bundle);
    
  } catch (error) {
    console.error('Error creating sample bundle:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSampleBundle();
