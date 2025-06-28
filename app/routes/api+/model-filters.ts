import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import { db } from "~/database/db.server";
import { getSelectedOrganisation } from "~/modules/organization/context.server";
import { assetCacheUtils } from "~/utils/cache.server";
import { makeShelfError } from "~/utils/error";
import { data, error, parseData } from "~/utils/http.server";

const BasicModelFilters = z.object({
  /** key of field for which we have to filter values */
  queryKey: z.string(),

  /** Actual value */
  queryValue: z.string().optional(),

  /** What user have already selected, so that we can exclude them */
  selectedValues: z.string().optional(),
});

/**
 * The schema used for each different model.
 * To allow filtersing and searching on different models update the schema for the relevant model
 */
export const ModelFiltersSchema = z.discriminatedUnion("name", [
  BasicModelFilters.extend({
    name: z.literal("asset"),
  }),
  BasicModelFilters.extend({
    name: z.literal("tag"),
  }),
  BasicModelFilters.extend({
    name: z.literal("category"),
  }),
  BasicModelFilters.extend({
    name: z.literal("location"),
  }),
  BasicModelFilters.extend({
    name: z.literal("kit"),
  }),
  BasicModelFilters.extend({
    name: z.literal("teamMember"),
    deletedAt: z.string().nullable().optional(),
    userWithAdminAndOwnerOnly: z.coerce.boolean().optional(), // To get only the teamMembers which are admin or owner
  }),
  BasicModelFilters.extend({
    name: z.literal("booking"),
  }),
]);

export type AllowedModelNames = z.infer<typeof ModelFiltersSchema>["name"];
export type ModelFilters = z.infer<typeof ModelFiltersSchema>;
export type ModelFiltersLoader = typeof loader;

export async function loader({ context, request }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  try {
    const { organizationId } = await getSelectedOrganisation({
      userId,
      request,
    }).catch((orgError) => {
      console.error("Organization selection failed:", orgError);
      throw new Error("Unable to determine organization. Please refresh and try again.");
    });

    /** Getting all the query parameters from url */
    const url = new URL(request.url);
    const searchParams: Record<string, any> = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (value === "null") {
        searchParams[key] = null;
      } else {
        searchParams[key] = value;
      }
    }

    /** Validating parameters */
    const modelFilters = parseData(searchParams, ModelFiltersSchema);
    const { name, queryKey, queryValue, selectedValues } = modelFilters;

    // Create cache key for model filters - cache based on query params
    const cacheKey = `model_filters_${organizationId}_${name}_${queryKey}_${queryValue || 'empty'}_${selectedValues || 'none'}`;
    
    // Cache for longer if it's a simple list without search
    const cacheTime = (!queryValue || queryValue === '') ? 1000 * 60 * 10 : 1000 * 60 * 2; // 10 min vs 2 min
    
    // Use cache with fallback on error
    const cachedResult = await assetCacheUtils.withCache(
      cacheKey, 
      async () => {
        const where: Record<string, any> = {
          organizationId,
        };
        
        // Only add the OR condition if there are selectedValues to search for
        if (selectedValues && selectedValues.trim() !== '') {
          where.OR = [{ id: { in: selectedValues.split(",").filter(id => id.trim() !== '') } }];
        } else {
          where.OR = [];
        }
        
        /**
         * When searching for teamMember, we have to search for
         * - teamMember's name
         * - teamMember's user firstName, lastName and email
         */
        if (modelFilters.name === "teamMember") {
          where.OR.push(
            { name: { contains: queryValue, mode: "insensitive" } },
            { user: { firstName: { contains: queryValue, mode: "insensitive" } } },
            { user: { lastName: { contains: queryValue, mode: "insensitive" } } },
            { user: { email: { contains: queryValue, mode: "insensitive" } } }
          );

          where.deletedAt = modelFilters.deletedAt;
          if (modelFilters.userWithAdminAndOwnerOnly) {
            where.AND = [
              { user: { isNot: null } },
              {
                user: {
                  userOrganizations: {
                    some: {
                      AND: [
                        { organizationId },
                        { roles: { hasSome: ["ADMIN", "OWNER"] } },
                      ],
                    },
                  },
                },
              },
            ];
          }
        } else {
          where.OR.push({
            [queryKey]: { contains: queryValue, mode: "insensitive" },
          });
        }

        // Use correct Prisma method for database queries
        let queryData: Array<Record<string, any>> = [];
        
        try {
          if (name === "teamMember") {
            queryData = await db.teamMember.findMany({
              where,
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            });
          } else if (name === "tag") {
            queryData = await db.tag.findMany({ where });
          } else if (name === "category") {
            queryData = await db.category.findMany({ where });
          } else if (name === "location") {
            queryData = await db.location.findMany({ where });
          } else if (name === "kit") {
            queryData = await db.kit.findMany({ where });
          } else if (name === "asset") {
            queryData = await db.asset.findMany({ where });
          } else if (name === "booking") {
            queryData = await db.booking.findMany({ where });
          } else {
            throw new Error(`Unsupported model name: ${name}`);
          }
        } catch (dbError) {
          console.error(`Database query failed for model ${name}:`, dbError);
          return { filters: [] }; // Return empty result as fallback
        }

        return {
          filters: queryData.map((item) => ({
            id: item.id,
            name: item[queryKey] || item.name || '',
            color: item?.color,
            metadata: item,
            user: item?.user,
          })),
        };
      }, 
      { ttl: cacheTime, fallbackOnError: true }
    );

    return json(data(cachedResult));
  } catch (cause) {
    console.error("Model filters loader error:", { 
      error: cause, 
      userId, 
      url: request.url,
      searchParams: Object.fromEntries(new URL(request.url).searchParams) 
    });
    
    // Always return empty filters as fallback instead of failing completely
    // This ensures the UI doesn't break when the API has issues
    return json(
      data({
        filters: [],
      })
    );
  }
}
