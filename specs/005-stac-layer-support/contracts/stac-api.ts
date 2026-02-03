/**
 * STAC API Interaction Types
 *
 * This file defines types and utilities for interacting with STAC APIs,
 * including request parameters and response handling.
 */

/**
 * Parameters for fetching STAC items from a collection.
 *
 * These parameters are passed to the STAC API /items endpoint
 * via ogc-client's StacEndpoint.getCollectionItemsResponse() method.
 */
export interface StacItemsRequestParams {
  /** Bounding box [west, south, east, north] for spatial filtering */
  bbox?: number[]

  /** Temporal filter with start and/or end dates */
  datetime?: {
    start?: Date
    end?: Date
  }

  /** Maximum number of items to return per page */
  limit?: number
}

/**
 * STAC API item collection response.
 *
 * Represents the structure returned by STAC API /items endpoints.
 * This is a GeoJSON FeatureCollection with additional STAC metadata.
 */
export interface StacItemsResponse {
  /** Always 'FeatureCollection' */
  type: 'FeatureCollection'

  /** Array of STAC items (GeoJSON Features) */
  features: GeoJSON.Feature[]

  /** Number of items matching the query (may be null/undefined) */
  numberMatched?: number | null

  /** Number of items returned in this response */
  numberReturned?: number

  /** Pagination and metadata links */
  links?: StacLink[]
}

/**
 * STAC API link structure for pagination and metadata.
 */
export interface StacLink {
  /** Link relation type (e.g., 'next', 'previous', 'self', 'root') */
  rel: string

  /** Link URL */
  href: string

  /** MIME type of the linked resource */
  type?: string

  /** Human-readable link title */
  title?: string
}

/**
 * Convert date range filter to STAC API datetime parameter format.
 *
 * STAC API datetime format:
 * - Both dates: "2023-01-01T00:00:00Z/2023-12-31T23:59:59Z"
 * - Only start: "2023-01-01T00:00:00Z/.."
 * - Only end: "../2023-12-31T23:59:59Z"
 * - No dates: undefined (no filter)
 *
 * @param start - Start date (nullable)
 * @param end - End date (nullable)
 * @returns STAC API datetime parameter or undefined
 */
export function formatDatetimeForStac(
  start: Date | null,
  end: Date | null,
): { start?: Date; end?: Date } | undefined {
  if (!start && !end) {
    return undefined
  }

  return {
    ...(start && { start }),
    ...(end && { end }),
  }
}

/**
 * Validate bounding box coordinates.
 *
 * @param bbox - Bounding box [west, south, east, north]
 * @returns True if bbox is valid
 */
export function isValidBbox(bbox: number[] | null): bbox is number[] {
  if (!bbox || bbox.length !== 4) {
    return false
  }

  const [west, south, east, north] = bbox

  // Validate coordinate ranges
  if (west < -180 || west > 180 || east < -180 || east > 180) {
    return false
  }

  if (south < -90 || south > 90 || north < -90 || north > 90) {
    return false
  }

  // Validate logical constraints
  if (west >= east || south >= north) {
    return false
  }

  return true
}

/**
 * Extract pagination links from STAC API response.
 *
 * @param response - STAC API response
 * @returns Object with next and prev link URLs
 */
export function extractPaginationLinks(response: StacItemsResponse): {
  nextLink: string | null
  previousLink: string | null
} {
  const links = response.links || []

  const nextLink = links.find((link) => link.rel === 'next')?.href || null
  const previousLink = links.find((link) => link.rel === 'previous')?.href || null

  return { nextLink, previousLink }
}

/**
 * Build STAC items request parameters from filter state.
 *
 * @param filters - Current filter configuration
 * @param itemsPerPage - Number of items per page
 * @returns STAC API request parameters
 */
export function buildStacRequestParams(
  filters: {
    dateRange: { start: Date | null; end: Date | null }
    spatialExtent: { enabled: boolean; bbox: number[] | null }
  },
  itemsPerPage: number,
): StacItemsRequestParams {
  const params: StacItemsRequestParams = {
    limit: itemsPerPage,
  }

  // Add temporal filter if dates are set
  const datetime = formatDatetimeForStac(filters.dateRange.start, filters.dateRange.end)
  if (datetime) {
    params.datetime = datetime
  }

  // Add spatial filter if enabled and valid
  if (filters.spatialExtent.enabled && isValidBbox(filters.spatialExtent.bbox)) {
    params.bbox = filters.spatialExtent.bbox
  }

  return params
}
