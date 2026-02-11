import type { GetCollectionItemsOptions, StacItemsDocument } from '@camptocamp/ogc-client'
import { StacEndpoint } from '@camptocamp/ogc-client'
import type {
  MapLayerStac,
  StacLayerInfo,
  StacFilters,
  DateRangeFilter,
  SpatialExtentFilter,
} from '@/types/stac.types'
import type { FeatureCollection } from 'geojson'
import type { MapLayer } from './layer.utils'

const DEFAULT_ITEMS_PER_PAGE = 100

export async function enrichStacLayer(layer: MapLayerStac) {
  if (layer.data || layer.error) return

  const stacLayerInfo = await getStacLayerInfo(layer)
  const updates: Partial<MapLayer> = {
    label: stacLayerInfo.label,
    filters: stacLayerInfo.filters,
    initialFilters: stacLayerInfo.initialFilters,
    data: stacLayerInfo.data,
    pagination: stacLayerInfo.pagination,
    version: (layer.version || 0) + 1,
    error: stacLayerInfo.error,
  }
  return { ...layer, ...updates } as MapLayerStac
}

export async function getStacLayerInfo(
  layer: MapLayerStac,
  updatedFilters?: StacFilters,
): Promise<StacLayerInfo> {
  const stacLayerInfo: StacLayerInfo = {}

  try {
    if (!layer.label || !layer.filters) {
      const { label, filters } = await getLabelAndFiltersFromMetadata(layer)
      stacLayerInfo.label = label
      stacLayerInfo.filters = filters
      stacLayerInfo.initialFilters = filters
    }

    const itemsResponse = await fetchItems(layer, updatedFilters)
    const { nextLink, previousLink } = extractPaginationLinks(itemsResponse)

    stacLayerInfo.pagination = {
      returnedItems:
        itemsResponse.numberReturned ||
        (itemsResponse.context as { returned?: number })?.returned || // accept for backwards compatibility
        null,
      itemsPerPage: layer.pagination?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE,
      currentPage: 1,
      nextLink,
      previousLink,
    }

    stacLayerInfo.data = itemsResponse as FeatureCollection

    return stacLayerInfo
  } catch (error) {
    console.error('Error enriching STAC layer:', error)
    stacLayerInfo.error = true
    return stacLayerInfo
  }
}

export async function fetchPage(
  layer: MapLayerStac,
  direction: 'next' | 'previous',
): Promise<StacLayerInfo> {
  const link = direction === 'next' ? layer.pagination?.nextLink : layer.pagination?.previousLink

  if (!link) {
    throw new Error(`No ${direction} page available`)
  }

  const response = await fetchItemsFromUrl(link)
  const { nextLink, previousLink } = extractPaginationLinks(response)

  return {
    data: response as FeatureCollection,
    pagination: {
      returnedItems:
        response.numberReturned || (response.context as { returned?: number })?.returned || null,
      itemsPerPage: layer.pagination?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE,
      currentPage:
        direction === 'next'
          ? (layer.pagination?.currentPage || 1) + 1
          : Math.max(1, (layer.pagination?.currentPage || 1) - 1),
      nextLink,
      previousLink,
    },
  }
}

async function getLabelAndFiltersFromMetadata(layer: MapLayerStac): Promise<{
  label: string
  filters: StacFilters
}> {
  const metadata = await fetchCollectionMetadata(layer)
  const label = metadata.title || layer.collectionId || 'STAC Collection'

  const filters = {
    dateRange: {
      start: metadata.extent?.temporal?.interval?.[0]?.[0]
        ? new Date(metadata.extent.temporal.interval[0][0])
        : null,
      end: metadata.extent?.temporal?.interval?.[0]?.[1]
        ? new Date(metadata.extent.temporal.interval[0][1])
        : null,
    },
    spatialExtent: {
      enabled: false,
      bbox: metadata.extent?.spatial?.bbox?.[0] || null,
    },
  }

  return { label, filters }
}

async function getStacEndpointWithCollectionId(
  layer: MapLayerStac,
): Promise<{ endpoint: StacEndpoint; collectionId: string }> {
  let rootUrl: string
  let collectionId: string

  if (layer.url && layer.collectionId) {
    rootUrl = layer.url
    collectionId = layer.collectionId
  } else {
    const collectionDoc = await (await StacEndpoint.fromUrl(layer.url)).data
    const rootLink = collectionDoc.links.find((link) => link.rel === 'root')
    rootUrl = rootLink?.href || ''
    collectionId = collectionDoc.id
    if (!rootUrl || !collectionId) {
      throw new Error('Invalid STAC collection document')
    }
  }
  return { endpoint: new StacEndpoint(rootUrl), collectionId }
}

async function fetchCollectionMetadata(layer: MapLayerStac) {
  const { endpoint, collectionId } = await getStacEndpointWithCollectionId(layer)
  return await endpoint.getCollection(collectionId)
}

async function fetchItems(
  layer: MapLayerStac,
  updatedFilters?: StacFilters,
): Promise<StacItemsDocument> {
  const { endpoint, collectionId } = await getStacEndpointWithCollectionId(layer)
  const params = buildStacRequestParams(
    updatedFilters || layer.filters,
    layer.pagination?.itemsPerPage,
  )
  return await endpoint.getCollectionItemsResponse(collectionId, params)
}

async function fetchItemsFromUrl(itemsUrl: string) {
  const response = await fetch(itemsUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch STAC items from ${itemsUrl}: ${response.statusText}`)
  }
  return await response.json()
}

/**
 * Convert date range filter to STAC API datetime parameter format.
 *
 * Converts date range to the format expected by ogc-client's GetCollectionItemsOptions.
 * The datetime parameter can be:
 * - A single Date object
 * - { start: Date } for open-ended start
 * - { end: Date } for open-ended end
 * - { start: Date, end: Date } for a closed range
 *
 * @param start - Start date (nullable)
 * @param end - End date (nullable)
 * @returns STAC API datetime parameter or undefined
 */
function formatDatetimeForStac(
  start: Date | string | null,
  end: Date | string | null,
): GetCollectionItemsOptions['datetime'] {
  if (typeof start === 'string') {
    start = new Date(start)
  }
  if (typeof end === 'string') {
    end = new Date(end)
  }
  if (!start && !end) {
    return undefined
  }

  if (start && end) {
    return { start, end }
  }

  if (start) {
    return { start }
  }

  if (end) {
    return { end }
  }

  return undefined
}

/**
 * Validate bounding box coordinates.
 *
 * @param bbox - Bounding box [west, south, east, north]
 * @returns True if bbox is valid
 */
function isValidBbox(bbox: number[] | null): bbox is [number, number, number, number] {
  if (!bbox || bbox.length !== 4) {
    return false
  }

  const west = bbox[0]
  const south = bbox[1]
  const east = bbox[2]
  const north = bbox[3]

  // Check all values are defined
  if (
    typeof west !== 'number' ||
    typeof south !== 'number' ||
    typeof east !== 'number' ||
    typeof north !== 'number'
  ) {
    return false
  }

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
 * @param response - STAC API response (StacItemsDocument from ogc-client)
 * @returns Object with next and prev link URLs
 */
function extractPaginationLinks(response: StacItemsDocument): {
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
 * Converts application filter state to ogc-client's GetCollectionItemsOptions format.
 *
 * @param filters - Current filter configuration
 * @param itemsPerPage - Number of items per page
 * @returns STAC API request parameters compatible with ogc-client
 */
function buildStacRequestParams(
  filters?: {
    dateRange: DateRangeFilter
    spatialExtent: SpatialExtentFilter
  },
  itemsPerPage: number = DEFAULT_ITEMS_PER_PAGE,
): GetCollectionItemsOptions {
  const params: GetCollectionItemsOptions = {
    limit: itemsPerPage,
  }

  if (!filters) {
    return params
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
