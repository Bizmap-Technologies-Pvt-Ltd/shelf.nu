import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import { getWorkingHoursForOrganization } from "~/modules/working-hours/service.server";
import { assetCacheUtils } from "~/utils/cache.server";
import { makeShelfError, ShelfError } from "~/utils/error";
import { data, error, getParams } from "~/utils/http.server";
import {
  PermissionAction,
  PermissionEntity,
} from "~/utils/permissions/permission.data";
import { requirePermission } from "~/utils/roles.server";

export async function loader({ context, request, params }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  try {
    const { organizationId: paramOrgId } = getParams(
      params,
      z.object({ organizationId: z.string() }),
      { additionalData: { userId } }
    );

    // Verify user has permission to read working hours for this organization
    const { organizationId } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.workingHours,
      action: PermissionAction.read,
    });

    // Ensure the requested org matches the user's current org
    if (paramOrgId !== organizationId) {
      throw new ShelfError({
        cause: null,
        message: "Organization access denied",
        label: "Working hours",
      });
    }

    // Cache working hours as they don't change frequently
    const cacheKey = `working_hours_${organizationId}`;
    const workingHours = await assetCacheUtils.withCache(cacheKey, async () => {
      return await getWorkingHoursForOrganization(organizationId);
    });

    return json(
      data({
        workingHours: {
          ...workingHours,
          overrides: workingHours.overrides.map((override) => ({
            ...override,
            date: override.date.toISOString(),
          })),
        },
      })
    );
  } catch (cause) {
    const reason = makeShelfError(cause, { userId });
    return json(error(reason), { status: reason.status });
  }
}
