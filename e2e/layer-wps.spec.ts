import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/wps/${name}`, import.meta.url), 'utf-8')

const THEMES = ['Nutriments', 'Phytoplancton', 'Microbiologie']

const WMS_URL = 'https://sextant.ifremer.fr/services/wms/surval'
const ES_URL = 'https://sextant.ifremer.fr/geonetwork/index/features'

/**
 * The whole chain behind the layer's "Traitements" tab: WMS capabilities → MetadataURL → GeoNetwork
 * record → its `OGC:WPS` resource, plus the ElasticSearch index the "Filtre" tab needs so a
 * selection can actually be made.
 *
 * Every URL is absolute and cross-origin, as the fixtures declare them: a record's `<cit:linkage>`
 * and a capabilities `MetadataURL` always are, so a relative stand-in would exercise the
 * resolve-against-`location` path that only the dev proxy takes.
 */
const mockLayerChain = async (page: Page) => {
  await page.route('**/services/wms/surval**', (route) =>
    route.fulfill({ contentType: 'application/xml', body: fixture('wms-surval-capabilities.xml') }),
  )

  await page.route('**/geonetwork/srv/api/records/**', (route) =>
    route.fulfill({ contentType: 'application/xml', body: fixture('gn-record-surval.xml') }),
  )

  // One route for every ES search: an aggregation request asks for a column's distinct values, any
  // other one is a count (or the detection probe, which also wants a sample document).
  await page.route('**/geonetwork/index/features', (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    if (body.aggs) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          hits: { total: { value: 30 } },
          aggregations: {
            values: {
              buckets: THEMES.map((key, index) => ({ key, doc_count: 10 - index })),
            },
          },
        }),
      })
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        hits: {
          total: { value: 30 },
          hits: [{ _source: { featureTypeId: 'ft', ft_THEME_s: THEMES[0] } }],
        },
      }),
    })
  })

  await page.route('**/services/wps3/demo**', (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      return route.fulfill({
        contentType: 'application/xml',
        body: fixture('execute-succeeded.xml'),
      })
    }
    if (/request=describeprocess/i.test(request.url())) {
      return route.fulfill({
        contentType: 'application/xml',
        body: fixture('describeprocess-demo-inputs.xml'),
      })
    }
    return route.fulfill({ contentType: 'application/xml', body: fixture('capabilities.xml') })
  })
}

// The global tools panel has a "Traitements" tab of its own, so the layer's tabs are addressed
// inside the "Couches" panel that holds them.
const layerTab = (page: Page, name: string) =>
  page.getByLabel('Couches').getByRole('tab', { name })

const loadSurvalLayer = async (page: Page) => {
  await page.goto('/demo/')
  await page.waitForFunction(
    () =>
      !!(document.getElementById('viewer') as unknown as { setInitialContext?: unknown })
        ?.setInitialContext,
  )
  await page.evaluate(
    ([wmsUrl, esUrl]) =>
      (
        document.getElementById('viewer') as unknown as {
          setInitialContext: (context: unknown, apply?: boolean) => void
        }
      ).setInitialContext(
        {
          layers: [{ type: 'wms', url: wmsUrl, name: 'surval', label: 'Surval' }],
          backgroundLayers: [],
          view: { center: [0, 0], zoom: 2 },
          dataSources: [{ type: 'geonetwork-index', url: esUrl }],
        },
        true,
      ),
    [WMS_URL, ES_URL],
  )
  await page.getByRole('tab', { name: 'Couches' }).click()
  await page.getByText('Surval').click()
}

/** Open the "Filtre" tab, expand the THEME column, and tick the given values. */
const selectThemes = async (page: Page, ...themes: string[]) => {
  await layerTab(page, 'Filtre').click()
  await page.getByRole('button', { name: 'Thème' }).click()
  for (const theme of themes) {
    await page.getByRole('checkbox', { name: new RegExp(theme) }).click()
  }
}

const executeBody = async (page: Page) => {
  const [request] = await Promise.all([
    page.waitForRequest(
      (candidate) => candidate.method() === 'POST' && candidate.url().includes('/services/wps3/'),
    ),
    page.getByRole('button', { name: 'Exécuter' }).click(),
  ])
  return request.postData() ?? ''
}

test.describe('layer WPS processes', () => {
  test.beforeEach(async ({ page }) => {
    await mockLayerChain(page)
  })

  test('offers the processes its record declares, labelled by the record', async ({ page }) => {
    await loadSurvalLayer(page)

    // The tab only exists once the background detection has read the record.
    await expect(layerTab(page, 'Traitements')).toBeVisible()
    await layerTab(page, 'Traitements').click()

    // A single declared process needs no selector — it is loaded straight away.
    await expect(page.getByRole('combobox', { name: 'Traitement de la couche' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Exécuter' })).toBeEnabled()
  })

  test('hides the inputs the profile wires, and sends the filter values for them', async ({
    page,
  }) => {
    await loadSurvalLayer(page)
    await selectThemes(page, 'Nutriments', 'Phytoplancton')

    await layerTab(page, 'Traitements').click()
    await expect(page.getByRole('button', { name: 'Exécuter' })).toBeEnabled()

    // STRING is linked and hidden, INT is hidden with a profile default: neither is rendered, while
    // the inputs the profile says nothing about stay on screen.
    await expect(page.getByText('A text string')).toHaveCount(0)
    await expect(page.getByText('An integer')).toHaveCount(0)
    await expect(page.getByText('A spatial extent')).toBeVisible()

    const body = await executeBody(page)

    // tokenizeWfsFilterValues joins the two selected themes into one value, delimiter from the
    // profile — the point of the whole feature: no retyping of what was already filtered.
    expect(body).toContain('<ows:Identifier>STRING</ows:Identifier>')
    expect(body).toContain('<wps:LiteralData>Nutriments;Phytoplancton</wps:LiteralData>')
    // A hidden input with no linked value still sends the profile's default.
    expect(body).toContain('<ows:Identifier>INT</ows:Identifier>')
    expect(body).toContain('<wps:LiteralData>42</wps:LiteralData>')
  })

  test('preselects the mime type the record names, and states where it comes from', async ({
    page,
  }) => {
    await loadSurvalLayer(page)
    await layerTab(page, 'Traitements').click()
    await expect(page.getByRole('button', { name: 'Exécuter' })).toBeEnabled()

    // The service advertises only octet-stream, so the profile's zip is offered but labelled as
    // unadvertised rather than silently dropped — and it is what gets requested.
    const format = page.getByRole('combobox', { name: 'Format de defined inputs as file' })
    await expect(format).toContainText('application/zip — non annoncé par le service')
    await expect(page.getByText('Format par défaut issu de la fiche de métadonnées')).toBeVisible()

    expect(await executeBody(page)).toContain('application/zip')
  })

  test('leaves the tab out for a layer whose record declares no process', async ({ page }) => {
    await page.unroute('**/geonetwork/srv/api/records/**')
    await page.route('**/geonetwork/srv/api/records/**', (route) =>
      route.fulfill({
        contentType: 'application/xml',
        body: fixture('gn-record-surval.xml').replace('OGC:WPS', 'OGC:WWW'),
      }),
    )
    await loadSurvalLayer(page)

    // The "Filtre" tab proves the record was read: only its WPS half is missing.
    await expect(layerTab(page, 'Filtre')).toBeVisible()
    await expect(layerTab(page, 'Traitements')).toHaveCount(0)
  })
})
