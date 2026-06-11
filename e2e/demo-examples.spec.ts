import { test, expect, type Page } from '@playwright/test'

type ViewerContext = {
  layers: { label?: string; type: string; loading?: boolean; error?: boolean }[]
  backgroundLayers: { label?: string; type: string; loading?: boolean; error?: boolean }[]
  view: object
}

async function getViewerContext(page: Page): Promise<ViewerContext> {
  return page.evaluate(() => (document.getElementById('viewer') as any).getContext())
}

async function runExample(page: Page, exampleName: string) {
  await page.selectOption('#example-selector', { label: exampleName })
  await page.click('#run-btn')
}

test.describe('Demo Examples', { tag: ['@optional', '@examples'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/')
    // Wait for the custom element to expose its API (component is mounted)
    await page.waitForFunction(
      () => typeof (document.getElementById('viewer') as any)?.getContext === 'function',
      { timeout: 15000 },
    )
  })

  // Examples that call addLayer() — layers start empty, expect 1 after run
  const addLayerExamples: { name: string; label: string; timeout?: number }[] = [
    { name: 'Add XYZ layer', label: 'OpenStreetMap (XYZ)' },
    { name: 'Add WMS layer', label: 'Population INSEE (WMS)' },
    { name: 'Add WMTS layer', label: 'PLANIGNV2 (WMTS)' },
    { name: 'Add WFS layer', label: 'Lignes de bus Ilevia (WFS)' },
    { name: 'Add OGC API layer', label: 'Schéma cyclable - points durs (OGC API)' },
    { name: 'Add COG layer', label: 'COG Brest (OpenAerialMap) (COG)' },
    {
      name: 'Add GeoJSON layer with URL and style',
      label: 'Schéma cyclable 2035 (GeoJSON with URL)',
    },
    { name: 'Add GeoJSON layer with data', label: 'Points de test (GeoJSON with data)' },
    { name: 'Add Maplibre style layer', label: 'Voyager (Maplibre style)' },
    {
      name: 'Add STAC layer',
      label: 'EUMETSAT OSI SAF (STAC)',
      timeout: 30000, // STAC requires a network call to enrich the layer
    },
  ]

  for (const { name, label, timeout } of addLayerExamples) {
    test(`"${name}" adds the layer to context without JS errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(err.message))

      await runExample(page, name)

      await page.waitForFunction(
        () => {
          const layers = (document.getElementById('viewer') as any).getContext().layers
          return layers.length > 0 && !layers[0].loading
        },
        { timeout: timeout ?? 15000 },
      )

      const ctx = await getViewerContext(page)
      expect(ctx.layers).toHaveLength(1)
      expect(ctx.layers[0].label).toBe(label)
      expect(ctx.layers[0].error, 'layer has a loading error').toBe(false)
      expect(errors, `JS errors: ${errors.join('\n')}`).toHaveLength(0)
    })
  }

  test('"Set initial map context" replaces the context without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await runExample(page, 'Set initial map context')

    // The example sets backgroundLayers to a single OSM entry (replaces the default 5)
    await page.waitForFunction(
      () =>
        (document.getElementById('viewer') as any).getContext().backgroundLayers.length === 1,
      { timeout: 10000 },
    )

    const ctx = await getViewerContext(page)
    expect(ctx.backgroundLayers[0].label).toBe('OpenStreetMap')
    expect(ctx.layers).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  test('"Set map context" replaces layers and background without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await runExample(page, 'Set map context')

    await page.waitForFunction(
      () => (document.getElementById('viewer') as any).getContext().layers.length > 0,
      { timeout: 10000 },
    )

    const ctx = await getViewerContext(page)
    expect(ctx.layers).toHaveLength(1)
    expect(ctx.layers[0].label).toBe('Population INSEE (Add WMS layer)')
    expect(ctx.backgroundLayers).toHaveLength(1)
    expect(ctx.backgroundLayers[0].label).toBe('PLANIGNV2')
    expect(errors).toHaveLength(0)
  })

  test('"Get map context" logs context without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await runExample(page, 'Get map context')

    // Allow a tick for any async side-effects to surface
    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
  })

  test('"Set view by center and zoom" changes view without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await runExample(page, 'Set view by center and zoom')

    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
  })

  test('"Listen event" registers map-extent-change listener without JS errors', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await runExample(page, 'Listen event')

    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
  })
})
