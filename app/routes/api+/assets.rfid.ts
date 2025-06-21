import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import {
  getAssetByRfid,
  getAssetsByRfidBatch,
  checkRfidAvailability,
} from "~/modules/asset/service.server";
import { makeShelfError } from "~/utils/error";
import { data, error, parseData } from "~/utils/http.server";
import {
  PermissionAction,
  PermissionEntity,
} from "~/utils/permissions/permission.data";
import { requirePermission } from "~/utils/roles.server";

// Schema for single RFID lookup
const SingleRfidSchema = z.object({
  rfid: z.string().min(1, "RFID tag cannot be empty"),
});

// Schema for batch RFID lookup
const BatchRfidSchema = z.object({
  rfidTags: z.array(z.string()).min(1, "At least one RFID tag is required"),
});

// Schema for RFID availability check
const RfidAvailabilitySchema = z.object({
  rfid: z.string().min(1, "RFID tag cannot be empty"),
  excludeAssetId: z.string().optional(),
});

export async function loader({ request, context }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  try {
    const { organizationId, userOrganizations } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.asset,
      action: PermissionAction.read,
    });

    const url = new URL(request.url);
    const rfid = url.searchParams.get("rfid");
    const action = url.searchParams.get("action");

    if (!rfid) {
      throw new Error("RFID parameter is required");
    }

    switch (action) {
      case "check-availability": {
        const excludeAssetId = url.searchParams.get("excludeAssetId") || undefined;
        
        const availability = await checkRfidAvailability({
          rfid,
          organizationId,
          excludeAssetId,
        });

        return json(data(availability));
      }
      
      default: {
        // Default action: get asset by RFID
        const asset = await getAssetByRfid({
          rfid,
          organizationId,
          userOrganizations,
          include: {
            category: true,
            location: true,
            tags: true,
            custody: {
              include: {
                custodian: {
                  include: {
                    user: true,
                  },
                },
              },
            },
            kit: true,
          },
        });

        return json(data({ asset }));
      }
    }
  } catch (cause) {
    const reason = makeShelfError(cause, { userId });
    return json(error(reason), { status: reason.status });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  try {
    const { organizationId, userOrganizations } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.asset,
      action: PermissionAction.read,
    });

    // Handle both JSON and FormData requests
    const contentType = request.headers.get("content-type") || "";
    let requestData: any;
    let intent: string;

    if (contentType.includes("application/json")) {
      // Handle JSON request
      requestData = await request.json();
      intent = requestData.intent;
    } else {
      // Handle FormData request  
      const formData = await request.formData();
      requestData = formData;
      intent = formData.get("intent") as string;
    }

    switch (intent) {
      case "batch-lookup": {
        let rfidTags: string[];
        
        if (contentType.includes("application/json")) {
          // For JSON requests, validate directly
          const { rfidTags: tags } = BatchRfidSchema.parse(requestData);
          rfidTags = tags;
        } else {
          // For FormData requests, use parseData
          const { rfidTags: tags } = parseData(requestData, BatchRfidSchema);
          rfidTags = tags;
        }

        const assets = await getAssetsByRfidBatch({
          rfidTags,
          organizationId,
          userOrganizations,
          include: {
            category: true,
            location: true,
            tags: true,
            custody: {
              include: {
                custodian: {
                  include: {
                    user: true,
                  },
                },
              },
            },
            kit: true,
          },
        });

        return json(data({ assets }));
      }

      case "single-lookup": {
        let rfid: string;
        
        if (contentType.includes("application/json")) {
          const { rfid: rfidTag } = SingleRfidSchema.parse(requestData);
          rfid = rfidTag;
        } else {
          const { rfid: rfidTag } = parseData(requestData, SingleRfidSchema);
          rfid = rfidTag;
        }

        const asset = await getAssetByRfid({
          rfid,
          organizationId,
          userOrganizations,
          include: {
            category: true,
            location: true,
            tags: true,
            custody: {
              include: {
                custodian: {
                  include: {
                    user: true,
                  },
                },
              },
            },
            kit: true,
          },
        });

        return json(data({ asset }));
      }

      case "check-availability": {
        let rfid: string;
        let excludeAssetId: string | undefined;
        
        if (contentType.includes("application/json")) {
          const parsed = RfidAvailabilitySchema.parse(requestData);
          rfid = parsed.rfid;
          excludeAssetId = parsed.excludeAssetId;
        } else {
          const parsed = parseData(requestData, RfidAvailabilitySchema);
          rfid = parsed.rfid;
          excludeAssetId = parsed.excludeAssetId;
        }

        const availability = await checkRfidAvailability({
          rfid,
          organizationId,
          excludeAssetId,
        });

        return json(data(availability));
      }

      default: {
        throw new Error(`Unknown intent: ${intent}`);
      }
    }
  } catch (cause) {
    const reason = makeShelfError(cause, { userId });
    return json(error(reason), { status: reason.status });
  }
}
