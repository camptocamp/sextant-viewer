import { test, expect } from '@playwright/test'

test.describe('Background Layer Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('.ol-viewport').waitFor({ state: 'visible' })
  })

  test('shows the background layer selector button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Sélecteur de fond de plan' }),
    ).toBeVisible()
  })

  test('opens a dropdown listing all background layers', async ({ page }) => {
    await page.getByRole('button', { name: 'Sélecteur de fond de plan' }).click()

    await expect(page.getByRole('menuitem', { name: 'OpenStreetMap' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Plan IGN' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'BD ORTHO' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'BD PARCELLAIRE' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Relief' })).toBeVisible()
  })

  test('OpenStreetMap is selected by default', async ({ page }) => {
    const mapStore = await page.evaluate(() => {
      const app = (document.getElementById('app') as HTMLElement & { __vue_app__: any })
        .__vue_app__
      const store = app.config.globalProperties.$pinia._s.get('map')
      return store.backgroundLayers.map((l: { label: string; visibility: boolean }) => ({
        label: l.label,
        visibility: l.visibility,
      }))
    })

    const osm = mapStore.find((l: { label: string }) => l.label === 'OpenStreetMap')
    expect(osm?.visibility).toBe(true)

    const others = mapStore.filter((l: { label: string }) => l.label !== 'OpenStreetMap')
    others.forEach((l: { visibility: boolean }) => expect(l.visibility).toBe(false))
  })

  test('switches the active background layer', async ({ page }) => {
    await page.getByRole('button', { name: 'Sélecteur de fond de plan' }).click()
    await page.getByRole('menuitem', { name: 'Plan IGN' }).click()

    const mapStore = await page.evaluate(() => {
      const app = (document.getElementById('app') as HTMLElement & { __vue_app__: any })
        .__vue_app__
      const store = app.config.globalProperties.$pinia._s.get('map')
      return store.backgroundLayers.map((l: { label: string; visibility: boolean }) => ({
        label: l.label,
        visibility: l.visibility,
      }))
    })

    const planIgn = mapStore.find((l: { label: string }) => l.label === 'Plan IGN')
    expect(planIgn?.visibility).toBe(true)

    const osm = mapStore.find((l: { label: string }) => l.label === 'OpenStreetMap')
    expect(osm?.visibility).toBe(false)
  })
})
