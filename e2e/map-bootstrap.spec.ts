import { test, expect } from '@playwright/test'

test.describe('Map Bootstrap', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/')
  })

  test('renders the OpenLayers map viewport', async ({ page }) => {
    await expect(page.locator('.ol-viewport')).toBeVisible()
  })

  test('map canvas has non-zero dimensions', async ({ page }) => {
    await page.locator('.ol-viewport').waitFor({ state: 'visible' })
    const bounds = await page.locator('.ol-viewport').boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.width).toBeGreaterThan(0)
    expect(bounds!.height).toBeGreaterThan(0)
  })

  test('shows the layer panel with tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Couches' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Outils' })).toBeVisible()
  })

  test('shows the background layer selector button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Sélecteur de fond de plan' }),
    ).toBeVisible()
  })
})
