// Example: Creating a route that looks up assets by RFID
// File: app/routes/_layout+/assets.rfid-lookup.tsx

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { z } from "zod";
import { getAssetByRfid } from "~/modules/asset/service.server";
import { parseData, data, error } from "~/utils/http.server";
import { requirePermission } from "~/utils/roles.server";
import { PermissionAction, PermissionEntity } from "~/utils/permissions/permission.data";

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

    if (!rfid) {
      return json(data({ asset: null }));
    }

    // Use the RFID service to find the asset
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
              include: { user: true }
            }
          }
        }
      }
    });

    return json(data({ asset, rfid }));
  } catch (cause) {
    return json(error(cause));
  }
}

export default function RfidLookupPage() {
  const { asset, rfid } = useLoaderData<typeof loader>();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">RFID Asset Lookup</h1>
      
      <Form method="get" className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            name="rfid"
            placeholder="Enter RFID tag..."
            defaultValue={rfid || ""}
            className="border rounded px-3 py-2 flex-1"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Lookup
          </button>
        </div>
      </Form>

      {asset ? (
        <div className="border rounded-lg p-4 bg-green-50">
          <h2 className="text-xl font-semibold mb-2">{asset.title}</h2>
          <p><strong>RFID:</strong> {asset.rfid}</p>
          <p><strong>Description:</strong> {asset.description || "No description"}</p>
          <p><strong>Status:</strong> {asset.status}</p>
          {asset.category && (
            <p><strong>Category:</strong> {asset.category.name}</p>
          )}
          {asset.location && (
            <p><strong>Location:</strong> {asset.location.name}</p>
          )}
          {asset.custody && (
            <p><strong>Custodian:</strong> {asset.custody.custodian.name}</p>
          )}
        </div>
      ) : rfid ? (
        <div className="border rounded-lg p-4 bg-red-50">
          <p>No asset found with RFID: {rfid}</p>
        </div>
      ) : null}
    </div>
  );
}
