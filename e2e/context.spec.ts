import { test, expect, type Page } from '@playwright/test'

const CONTEXT = {
  view: { center: [2.35, 48.85], zoom: 8 },
  layers: [
    {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      label: 'Couche importée',
      visibility: true,
      opacity: 1,
    },
  ],
  backgroundLayers: [],
}

const SESSION_STORAGE_CONTEXT_KEY = 'sxt-viewer-current-map-context'

function importFile(page: Page, name: string, content: string) {
  return page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  })
}

// Wait for the web component to be upgraded before calling its API
function waitForViewer(page: Page) {
  return page.waitForFunction(() => {
    const viewer = document.querySelector('sxt-viewer') as HTMLElement & {
      setContext?: unknown
    }
    return typeof viewer?.setContext === 'function'
  })
}

test.describe('Context import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/')
    await page.getByRole('tab', { name: 'Outils' }).click()
  })

  test('applies a context read from a JSON file', async ({ page }) => {
    await importFile(page, 'map-context.json', JSON.stringify(CONTEXT))

    await page.getByRole('tab', { name: 'Couches' }).click()
    await expect(page.getByText('Couche importée')).toBeVisible()
  })

  test('reports an unreadable file', async ({ page }) => {
    await importFile(page, 'broken.json', '{oops')

    await expect(page.getByText('Fichier JSON illisible')).toBeVisible()
  })

  test('reports JSON that is not a context', async ({ page }) => {
    await importFile(page, 'nope.json', '{"layers": "x"}')

    await expect(page.getByText('Le fichier ne contient pas un contexte de carte')).toBeVisible()
  })
})

test.describe('Context validation', () => {
  test('setContext throws synchronously so the consumer can catch it', async ({ page }) => {
    await page.goto('/demo/')
    await waitForViewer(page)

    const thrown = await page.evaluate(() => {
      const viewer = document.querySelector('sxt-viewer') as HTMLElement & {
        setContext: (context: unknown) => void
      }
      try {
        viewer.setContext(null)
        return 'nothing thrown'
      } catch (error) {
        return (error as Error).constructor.name
      }
    })

    expect(thrown).toBe('TypeError')
  })

  // A bare JSON.parse used to run in the persistence store's setup, so an unusable stored value
  // failed the whole viewer mount and survived the reload.
  test('an unusable stored context neither blocks the mount nor sticks around', async ({
    page,
  }) => {
    await page.goto('/demo/')
    await page.evaluate((key) => sessionStorage.setItem(key, '{oops'), SESSION_STORAGE_CONTEXT_KEY)
    await page.reload()

    await waitForViewer(page)
    const context = await page.evaluate(() => {
      const viewer = document.querySelector('sxt-viewer') as HTMLElement & {
        getContext: () => unknown
      }
      return viewer.getContext()
    })
    expect(context).toBeTruthy()

    const leftover = await page.evaluate(
      (key) => sessionStorage.getItem(key),
      SESSION_STORAGE_CONTEXT_KEY,
    )
    expect(leftover).not.toBe('{oops')
  })
})
