import { test, expect } from '@playwright/test'

test.describe('Background Layer Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/')
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
    await page.getByRole('button', { name: 'Sélecteur de fond de plan' }).click()

    await expect(
      page.getByRole('menuitem', { name: 'OpenStreetMap' }).locator('[data-slot="itemLeadingIcon"]'),
    ).not.toHaveClass(/opacity-0/)
    await expect(
      page.getByRole('menuitem', { name: 'Plan IGN' }).locator('[data-slot="itemLeadingIcon"]'),
    ).toHaveClass(/opacity-0/)
  })

  test('switches the active background layer', async ({ page }) => {
    await page.getByRole('button', { name: 'Sélecteur de fond de plan' }).click()
    await page.getByRole('menuitem', { name: 'Plan IGN' }).click()

    await page.getByRole('button', { name: 'Sélecteur de fond de plan' }).click()

    await expect(
      page.getByRole('menuitem', { name: 'Plan IGN' }).locator('[data-slot="itemLeadingIcon"]'),
    ).not.toHaveClass(/opacity-0/)
    await expect(
      page.getByRole('menuitem', { name: 'OpenStreetMap' }).locator('[data-slot="itemLeadingIcon"]'),
    ).toHaveClass(/opacity-0/)
  })
})
