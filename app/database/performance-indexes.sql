-- Additional performance optimization indexes
-- Run this after existing migrations for better query performance

-- 1. Composite indexes for common asset queries
CREATE INDEX IF NOT EXISTS "Asset_organizationId_status_availableToBook_idx" 
ON public."Asset" ("organizationId", "status", "availableToBook");

CREATE INDEX IF NOT EXISTS "Asset_organizationId_title_trgm_idx" 
ON public."Asset" USING gin ("organizationId", lower("title") gin_trgm_ops);

-- 2. Indexes for search optimization
CREATE INDEX IF NOT EXISTS "Asset_title_description_trgm_idx" 
ON public."Asset" USING gin ((lower("title") || ' ' || coalesce(lower("description"), '')) gin_trgm_ops);

-- 3. Booking-related indexes for availability checks
CREATE INDEX IF NOT EXISTS "Booking_asset_time_status_idx" 
ON public."Booking" ("status", "from", "to") 
WHERE "status" IN ('RESERVED', 'ONGOING', 'OVERDUE');

-- 4. User organization lookup optimization
CREATE INDEX IF NOT EXISTS "UserOrganization_userId_organizationId_roles_idx" 
ON public."UserOrganization" ("userId", "organizationId", "roles");

-- 5. Category and location performance indexes
CREATE INDEX IF NOT EXISTS "Category_organizationId_name_idx" 
ON public."Category" ("organizationId", "name");

CREATE INDEX IF NOT EXISTS "Location_organizationId_name_idx" 
ON public."Location" ("organizationId", "name");

-- 6. Custom fields optimization
CREATE INDEX IF NOT EXISTS "CustomField_organizationId_active_idx" 
ON public."CustomField" ("organizationId", "active") 
WHERE "active" = true;

-- 7. Team member custody lookups
CREATE INDEX IF NOT EXISTS "TeamMember_organizationId_userId_idx" 
ON public."TeamMember" ("organizationId", "userId");

-- 8. Asset search view optimization (if using full-text search)
CREATE INDEX IF NOT EXISTS "AssetSearchView_searchVector_gin_idx" 
ON public."AssetSearchView" USING gin("searchVector" gin_trgm_ops);

-- 9. Session and authentication indexes
CREATE INDEX IF NOT EXISTS "Session_userId_expirationDate_idx" 
ON public."Session" ("userId", "expirationDate") 
WHERE "expirationDate" > NOW();

-- 10. Audit/logging indexes for performance monitoring
CREATE INDEX IF NOT EXISTS "Asset_createdAt_updatedAt_idx" 
ON public."Asset" ("createdAt", "updatedAt");

-- Enable pg_trgm extension if not already enabled (for fuzzy search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create function for better search performance
CREATE OR REPLACE FUNCTION search_assets(
  org_id TEXT,
  search_term TEXT,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
) RETURNS TABLE (
  id TEXT,
  title TEXT,
  description TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.description,
    ts_rank(
      to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.description, '')),
      plainto_tsquery('english', search_term)
    ) as rank
  FROM public."Asset" a
  WHERE a."organizationId" = org_id
    AND (
      a.title ILIKE '%' || search_term || '%'
      OR a.description ILIKE '%' || search_term || '%'
      OR to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.description, '')) 
         @@ plainto_tsquery('english', search_term)
    )
  ORDER BY rank DESC, a.title
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Performance monitoring view
CREATE OR REPLACE VIEW performance_monitor AS
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE schemaname = 'public' 
  AND tablename IN ('Asset', 'User', 'Organization', 'Booking', 'Category', 'Location')
ORDER BY tablename, attname;
