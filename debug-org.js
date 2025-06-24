// Script to check organization context and debug RFID lookup
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function debugOrganizationContext() {
  try {
    console.log('=== Organization Context Debug ===\n');
    
    // 1. Check all organizations
    const organizations = await db.organization.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        _count: {
          select: {
            assets: true,
            userOrganizations: true
          }
        }
      }
    });
    
    console.log('All Organizations:');
    organizations.forEach(org => {
      console.log(`- ${org.name} (${org.id}): ${org._count.assets} assets, ${org._count.userOrganizations} users`);
    });
    console.log('');
    
    // 2. Check specific RFID assets and their organizations
    const rfidAssets = await db.asset.findMany({
      where: {
        rfid: {
          in: ['TAG002', 'AA11BB', 'TAG007', 'TAG006', 'TAG005', 'TAG004', 'TAG003']
        }
      },
      select: {
        id: true,
        title: true,
        rfid: true,
        organizationId: true,
        organization: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log('RFID Assets with Organization Info:');
    rfidAssets.forEach(asset => {
      console.log(`- ${asset.rfid}: "${asset.title}" in org "${asset.organization.name}" (${asset.organizationId})`);
    });
    console.log('');
    
    // 3. Check users and their organizations
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userOrganizations: {
          select: {
            organizationId: true,
            organization: {
              select: {
                name: true
              }
            }
          }
        }
      },
      take: 5 // Just first 5 users
    });
    
    console.log('Users and their Organizations:');
    users.forEach(user => {
      console.log(`- ${user.email} (${user.firstName} ${user.lastName}):`);
      user.userOrganizations.forEach(userOrg => {
        console.log(`  * ${userOrg.organization.name} (${userOrg.organizationId})`);
      });
    });
    console.log('');
    
    // 4. Test specific RFID lookup for the organization
    const testRfid = 'TAG002';
    console.log(`=== Testing RFID lookup for ${testRfid} ===`);
    
    for (const org of organizations) {
      console.log(`\nTesting in organization: ${org.name} (${org.id})`);
      
      const asset = await db.asset.findFirst({
        where: {
          rfid: {
            equals: testRfid,
            mode: 'insensitive'
          },
          organizationId: org.id
        },
        select: {
          id: true,
          title: true,
          rfid: true,
          status: true,
          category: {
            select: { name: true }
          },
          location: {
            select: { name: true }
          }
        }
      });
      
      if (asset) {
        console.log(`✅ Found: ${asset.title} (${asset.status})`);
        console.log(`   Category: ${asset.category?.name || 'None'}`);
        console.log(`   Location: ${asset.location?.name || 'None'}`);
      } else {
        console.log(`❌ Not found in this organization`);
      }
    }
    
  } catch (error) {
    console.error('Error in debug script:', error);
  } finally {
    await db.$disconnect();
  }
}

debugOrganizationContext();
