import { fetchRecordResources } from './gnRecord'
import { resolveRecordRef } from './recordRef'
import type { MapLayer } from '../layer.utils'
import { splitSublayers } from '../wms.utils'
import type { LayerWpsProcess } from '@/types/wps.types'

/**
 * Detect the WPS processes a WMS layer's metadata record declares:
 *   1. WMS `GetCapabilities` → the first sublayer's `MetadataURL` → record uuid and GeoNetwork base;
 *   2. the record's `OGC:WPS` online resources, each one a process on a service with its profile.
 *
 * Deliberately independent of filter detection, and not only for elegance: that one gives up as
 * soon as no sublayer maps to a WFS resource or no ES index answers, which would cost an
 * unindexed layer the processes its record does declare. Hence no `dataSources` either — the record
 * to read is the one the `MetadataURL` points at, not the one that indexed the features.
 *
 * All of its requests are already shared: the capabilities by ogc-client's cache, the record by
 * `fetchRecordResources`.
 */
async function detectWpsProcesses(layer: MapLayer): Promise<LayerWpsProcess[] | null> {
  if (layer.type !== 'wms' || !layer.url || !layer.name) return null

  const sublayers = splitSublayers(layer.name)
  const ref = await resolveRecordRef(layer.url, sublayers[0] ?? layer.name)
  if (!ref?.gnBase) return null

  const { wps } = await fetchRecordResources(ref.gnBase, ref.uuid)
  return wps.length ? wps : null
}

/**
 * WPS processes declared by the layer's metadata record. `undefined` leaves the layer untouched (no
 * record, no `OGC:WPS` resource in it, or detection failed) so the store never sets an empty key.
 */
export async function resolveWpsProcesses(layer: MapLayer): Promise<LayerWpsProcess[] | undefined> {
  try {
    return (await detectWpsProcesses(layer)) ?? undefined
  } catch (error) {
    console.error('Erreur lors de la résolution des traitements WPS', error)
    return undefined
  }
}
