import { test, expect, type Page } from '@playwright/test'

type GeoJsonLayer = {
  type: 'geojson'
  id?: string
  data: { type: 'FeatureCollection'; features: object[] }
  label: string
  visibility: boolean
  opacity: number
}

async function addLayers(page: Page, layers: GeoJsonLayer[]) {
  // Wait for the web components to be upgraded
  await page.waitForFunction(() => {
    const viewer = document.querySelector('sxt-viewer') as HTMLElement & {
      addLayer?: unknown
    }
    return typeof viewer?.addLayer === 'function'
  })
  await page.evaluate(async (layers) => {
    const viewer = document.querySelector('sxt-viewer') as HTMLElement & {
      addLayer: (layer: GeoJsonLayer, zoomToExtent?: boolean) => Promise<void>
    }
    for (const layer of layers) await viewer.addLayer(layer, false)
  }, layers)
}

test.describe('Layer Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/')
    await page.getByRole('tab', { name: 'Liste' }).click()
  })

  test('displays a layer after it is added', async ({ page }) => {
    await addLayers(page, [
      {
        type: 'geojson',
        id: 'test-geojson',
        data: { type: 'FeatureCollection', features: [] },
        label: 'Couche GeoJSON',
        visibility: true,
        opacity: 1,
      },
    ])

    await expect(page.getByText('Couche GeoJSON')).toBeVisible()
  })

  test('lists multiple layers with last-in-array at top', async ({ page }) => {
    await addLayers(page, [
      {
        type: 'geojson',
        id: 'layer-a',
        data: { type: 'FeatureCollection', features: [] },
        label: 'Couche A',
        visibility: true,
        opacity: 1,
      },
      {
        type: 'geojson',
        id: 'layer-b',
        data: { type: 'FeatureCollection', features: [] },
        label: 'Couche B',
        visibility: true,
        opacity: 1,
      },
    ])

    // layers are reversed in the list: last in array = top of list (most visible)
    const items = page.locator('.layer-list > button')
    await expect(items.first()).toContainText('Couche B')
    await expect(items.nth(1)).toContainText('Couche A')
  })

  test('opens the details panel when a layer is clicked', async ({ page }) => {
    await addLayers(page, [
      {
        type: 'geojson',
        id: 'test-detail',
        data: { type: 'FeatureCollection', features: [] },
        label: 'Couche détails',
        visibility: true,
        opacity: 1,
      },
    ])

    await page.getByText('Couche détails').click()
    await expect(page.getByText('Transparence :')).toBeVisible()
    await expect(page.getByRole('button', { name: /Supprimer/ })).toBeVisible()
  })

  test('deletes a layer via the details panel', async ({ page }) => {
    await addLayers(page, [
      {
        type: 'geojson',
        id: 'test-delete',
        data: { type: 'FeatureCollection', features: [] },
        label: 'Couche à supprimer',
        visibility: true,
        opacity: 1,
      },
    ])

    await page.getByText('Couche à supprimer').click()
    await page.getByRole('button', { name: /Supprimer/ }).click()

    await expect(page.getByText('Couche à supprimer')).toBeHidden()
  })

  test('toggles layer visibility via the checkbox', async ({ page }) => {
    await addLayers(page, [
      {
        type: 'geojson',
        id: 'test-visibility',
        data: { type: 'FeatureCollection', features: [] },
        label: 'Couche visibilité',
        visibility: true,
        opacity: 1,
      },
    ])

    const checkbox = page
      .locator('.layer-list button')
      .filter({ hasText: 'Couche visibilité' })
      .getByRole('checkbox')

    await expect(checkbox).toBeChecked()
    await checkbox.click()
    await expect(checkbox).not.toBeChecked()
  })
})
