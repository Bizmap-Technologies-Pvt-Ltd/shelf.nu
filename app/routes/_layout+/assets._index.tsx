import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import type { ShouldRevalidateFunctionArgs } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { AssetsList } from "~/components/assets/assets-index/assets-list";
import { ImportButton } from "~/components/assets/import-button";
import Header from "~/components/layout/header";
import { Button } from "~/components/shared/button";
import When from "~/components/when/when";
import { db } from "~/database/db.server";

import { useAssetIndexViewState } from "~/hooks/use-asset-index-view-state";
import { useUserRoleHelper } from "~/hooks/user-user-role-helper";
import {
  advancedModeLoader,
  simpleModeLoader,
} from "~/modules/asset/data.server";
import { bulkDeleteAssets } from "~/modules/asset/service.server";
import { CurrentSearchParamsSchema } from "~/modules/asset/utils.server";
import {
  changeMode,
  getAssetIndexSettings,
} from "~/modules/asset-index-settings/service.server";
import assetCss from "~/styles/assets.css?url";
import calendarStyles from "~/styles/layout/calendar.css?url";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { checkExhaustiveSwitch } from "~/utils/check-exhaustive-switch";

import { sendNotification } from "~/utils/emitter/send-notification.server";
import { ShelfError, makeShelfError } from "~/utils/error";
import { data, error, parseData } from "~/utils/http.server";
import { measureRouteLoader } from "~/utils/performance.server";
import { preloadCache } from "~/utils/preload-cache.server";
import {
  PermissionAction,
  PermissionEntity,
} from "~/utils/permissions/permission.data";
import { userHasPermission } from "~/utils/permissions/permission.validator.client";
import { requirePermission } from "~/utils/roles.server";

export type AssetIndexLoaderData = typeof loader;

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: assetCss },
  { rel: "stylesheet", href: calendarStyles },
];

export async function loader({ context, request }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;
  
  return measureRouteLoader("assets._index", async () => {
    try {
      // Fast permission check with cached data and parallel user fetch
      const [permissionResult, user] = await Promise.all([
        requirePermission({
          userId,
          request,
          entity: PermissionEntity.asset,
          action: PermissionAction.read,
        }).catch((permissionError) => {
          console.error("Permission check failed:", permissionError);
          throw new ShelfError({
            cause: permissionError,
            message: "Permission verification failed. Please refresh and try again.",
            additionalData: { userId },
            label: "Assets",
            status: 403,
          });
        }),
        // Optimized user query with reliable fallback
        db.user.findUniqueOrThrow({
          where: { id: userId },
          select: { firstName: true },
        }).catch((userError) => {
          console.error("User fetch failed:", userError);
          // Return fallback user data instead of throwing
          return { firstName: null };
        }),
      ]);

      const { organizationId, organizations, currentOrganization, role } = permissionResult;

      // Validate critical data before proceeding
      if (!organizationId || !currentOrganization) {
        throw new ShelfError({
          cause: null,
          message: "Organization data not available. Please refresh the page.",
          additionalData: { userId, organizationId },
          label: "Assets",
          status: 400,
        });
      }

      // Fire and forget cache preloading for faster subsequent requests
      setImmediate(() => {
        preloadCache(organizationId, userId).catch((preloadError: any) => {
          console.warn("Cache preloading failed:", preloadError);
          // Don't fail the request for preload errors
        });
      });

      const settings = await getAssetIndexSettings({ userId, organizationId }).catch(async (settingsError) => {
        console.warn("Settings fetch failed, creating defaults:", settingsError);
        // Try to create default settings
        try {
          const { createUserAssetIndexSettings } = await import("~/modules/asset-index-settings/service.server");
          return await createUserAssetIndexSettings({ userId, organizationId });
        } catch (createError) {
          console.error("Failed to create default settings:", createError);
          // Last fallback - minimal settings object
          return {
            userId,
            organizationId,
            id: `temp-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            mode: "SIMPLE" as const,
            columns: [],
            freezeColumn: false,
            showAssetImage: true,
          };
        }
      });
      const mode = settings.mode;

      /** For base and self service users, we dont allow to view the advanced index */
      if (mode === "ADVANCED" && ["BASE", "SELF_SERVICE"].includes(role)) {
        await changeMode({
          userId,
          organizationId,
          mode: "SIMPLE",
        });
        throw new ShelfError({
          cause: null,
          title: "Not allowed",
          message:
            "You don't have permission to access the advanced mode. We will automatically switch you back to 'simple' mode. Please reload the page.",
          label: "Assets",
          status: 403,
        });
      }

      return mode === "SIMPLE"
        ? await simpleModeLoader({
            request,
            userId,
            organizationId,
            organizations,
            role,
            currentOrganization,
            user,
            settings,
          })
        : await advancedModeLoader({
            request,
            userId,
            organizationId,
            organizations,
            role,
            currentOrganization,
            user,
            settings,
          });
    } catch (cause) {
      const reason = makeShelfError(cause, { userId });
      throw json(error(reason), { status: reason.status });
    }
  });
}

export async function action({ context, request }: ActionFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  try {
    const formData = await request.formData();

    const { intent } = parseData(
      formData,
      z.object({ intent: z.enum(["bulk-delete"]) })
    );

    const intent2ActionMap: { [K in typeof intent]: PermissionAction } = {
      "bulk-delete": PermissionAction.delete,
    };

    const { organizationId } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.asset,
      action: intent2ActionMap[intent],
    });

    switch (intent) {
      case "bulk-delete": {
        const { assetIds, currentSearchParams } = parseData(
          formData,
          z
            .object({ assetIds: z.array(z.string()).min(1) })
            .and(CurrentSearchParamsSchema)
        );

        await bulkDeleteAssets({
          assetIds,
          organizationId,
          userId,
          currentSearchParams,
        });

        sendNotification({
          title: "Assets deleted",
          message: "Your assets has been deleted successfully",
          icon: { name: "success", variant: "success" },
          senderId: authSession.userId,
        });

        return json(data({ success: true }));
      }

      default: {
        checkExhaustiveSwitch(intent);
        return json(data(null));
      }
    }
  } catch (cause) {
    const reason = makeShelfError(cause, { userId });
    return json(error(reason), { status: reason.status });
  }
}

export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  formAction,
  actionResult,
}: ShouldRevalidateFunctionArgs) {
  // Only revalidate if:
  // 1. It's a form submission (POST, PUT, DELETE)
  // 2. URL search params have changed (filters, pagination)
  // 3. Organization has changed
  
  if (formMethod && formMethod !== "GET") {
    return true;
  }

  // Check if organizationId changed
  const currentOrgId = currentUrl.searchParams.get("organizationId");
  const nextOrgId = nextUrl.searchParams.get("organizationId");
  if (currentOrgId !== nextOrgId) {
    return true;
  }

  // Check if search/filter params changed
  const relevantParams = [
    "search", "status", "category", "location", "tag", "custody", 
    "page", "per", "sort", "order", "view"
  ];
  
  for (const param of relevantParams) {
    if (currentUrl.searchParams.get(param) !== nextUrl.searchParams.get(param)) {
      return true;
    }
  }

  // Don't revalidate for navigation without param changes
  return false;
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: appendToMetaTitle(data?.header.title) },
];

export default function AssetIndexPage() {
  const { roles } = useUserRoleHelper();
  const { canImportAssets } = useLoaderData<typeof loader>();
  const { modeIsAdvanced } = useAssetIndexViewState();

  return (
    <div className="relative">
      <Header hidePageDescription={modeIsAdvanced}>
        <When
          truthy={userHasPermission({
            roles,
            entity: PermissionEntity.asset,
            action: PermissionAction.create,
          })}
        >
          <>
            <ImportButton canImportAssets={canImportAssets} />
            <Button
              to="new"
              role="link"
              aria-label={`new asset`}
              icon="asset"
              data-test-id="createNewAsset"
            >
              New asset
            </Button>
          </>
        </When>
      </Header>
      <AssetsList />
    </div>
  );
}
