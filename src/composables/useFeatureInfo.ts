import type { FeatureAttribute, FeatureInfo } from '@/types/feature-selection.types'
import type { Feature } from 'geojson'

function getFeatureId(feature: Feature): string {
  if (feature.id !== undefined) {
    return `Objet #${feature.id}`
  }

  return 'Objet sans identifiant'
}

function formatAttributeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function extractUrlsFromValue(value: unknown): string[] {
  if (typeof value !== 'string') {
    return []
  }
  const regex = /\bhttps?:\/\/(?:\([^\s()]+\)|[^\s()]+)+/g
  return [...value.matchAll(regex)].map((match) => match[0])
}

export function useFeatureInfo() {
  function extractFeatureInfo(feature: Feature, layerName: string): FeatureInfo {
    const featureId = getFeatureId(feature)
    const properties = feature.properties || {}
    const attributes: FeatureAttribute[] = []

    for (const [name, value] of Object.entries(properties)) {
      attributes.push({
        name,
        value,
        displayValue: formatAttributeValue(value),
        urls: extractUrlsFromValue(value),
      })
    }

    return {
      layerName,
      featureId,
      attributes,
    }
  }

  return {
    extractFeatureInfo,
  }
}
