import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/wps/${name}`, import.meta.url), 'utf-8')

// Mock the Ifremer (Sextant) demo WPS with responses captured from the real service,
// so the panel flow is exercised end-to-end without hitting the network or CORS.
test.describe('WPS panel', () => {
  const mockWps = async (page: Page, executeResponse: string) => {
    const capabilities = fixture('capabilities.xml')
    const describeProcess = fixture('describeprocess-demo-inputs.xml')
    const output = fixture('output.json')

    await page.route('**/services/wps3/demo**', async (route) => {
      const request = route.request()
      const url = request.url()
      if (url.includes('/files/output.json')) {
        return route.fulfill({ contentType: 'application/octet-stream', body: output })
      }
      if (request.method() === 'POST') {
        return route.fulfill({ contentType: 'application/xml', body: executeResponse })
      }
      if (/request=describeprocess/i.test(url)) {
        return route.fulfill({ contentType: 'application/xml', body: describeProcess })
      }
      return route.fulfill({ contentType: 'application/xml', body: capabilities })
    })
  }

  const WPS_URL = 'https://sextant.ifremer.fr/services/wps3/demo'

  const declareService = async (page: Page, service: { url: string; label?: string }) => {
    await page.waitForFunction(
      () =>
        !!(document.getElementById('viewer') as unknown as { addWpsService?: unknown })
          ?.addWpsService,
    )
    await page.evaluate(
      (s) =>
        (
          document.getElementById('viewer') as unknown as {
            addWpsService: (s: { url: string; label?: string }) => void
          }
        ).addWpsService(s),
      service,
    )
  }

  const runDemoProcess = async (page: Page) => {
    await page.goto('/demo/')
    await page.getByRole('tab', { name: 'Traitements (WPS)' }).click()
    // Nothing is preselected: type the URL freely.
    await page.getByLabel('URL du service WPS').fill(WPS_URL)
    await page.getByRole('button', { name: 'Charger' }).click()
    await page.getByText('Choisir un traitement').click()
    await page.getByRole('option', { name: 'Ifremer input example' }).click()
    await expect(page.getByText('A text string')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Exécuter' })).toBeEnabled()
    await page.getByRole('button', { name: 'Exécuter' }).click()
  }

  test('starts with an empty service field and accepts a free-text URL', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded.xml'))
    await page.goto('/demo/')
    await declareService(page, { url: WPS_URL, label: 'Sextant WPS (démo)' })
    await page.getByRole('tab', { name: 'Traitements (WPS)' }).click()
    // Nothing preselected even though a service is declared.
    await expect(page.getByLabel('URL du service WPS')).toHaveValue('')
    await page.getByLabel('URL du service WPS').fill(WPS_URL)
    await page.getByRole('button', { name: 'Charger' }).click()
    await expect(page.getByText('Choisir un traitement')).toBeVisible()
  })

  test('fills the URL field when a predefined service is selected', async ({ page }) => {
    await page.goto('/demo/')
    await declareService(page, { url: 'https://host/wps/a', label: 'Service A' })
    await declareService(page, { url: 'https://host/wps/b', label: 'Service B' })
    await page.getByRole('tab', { name: 'Traitements (WPS)' }).click()
    // The predefined services are listed in a select; picking one fills the URL input.
    await page.getByText('Services prédéfinis').click()
    await expect(page.getByRole('option', { name: 'Service A' })).toBeVisible()
    await page.getByRole('option', { name: 'Service B' }).click()
    await expect(page.getByLabel('URL du service WPS')).toHaveValue('https://host/wps/b')
  })

  test('runs a process whose octet-stream output falls back to download', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded.xml'))
    await runDemoProcess(page)

    await expect(page.getByText('Exécution réussie')).toBeVisible()
    // OUTPUT is an octet-stream reference → download, not a layer.
    await expect(page.getByRole('link', { name: 'Télécharger' })).toBeVisible()
    await expect(page.getByText('Couche ajoutée à la carte')).toHaveCount(0)
  })

  test('adds a WMS output as a layer and switches to the Couches tab', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded-wms.xml'))
    await page.route('**/services/wms/demo**', (route) =>
      route.fulfill({ contentType: 'application/xml', body: fixture('wms-capabilities.xml') }),
    )
    await runDemoProcess(page)

    // The successful WMS output switches the panel to the "Couches" tab, where every
    // named layer from the GetCapabilities is listed (faithful to Sextant).
    await expect(page.getByRole('tab', { name: 'Couches', selected: true })).toBeVisible()
    await expect(page.getByText('Demo points')).toBeVisible()
    await expect(page.getByText('Demo lines')).toBeVisible()
  })
})
