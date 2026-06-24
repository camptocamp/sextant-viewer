# Plan — Intégration WPS dans le `viewer` (+ endpoint WPS dans `ogc-client`)

## Objectif

Permettre à l'utilisateur du `viewer` de :

1. **Saisir l'URL d'un service WPS** et **choisir un processus** (liste issue d'un
   `GetCapabilities`).
2. Voir apparaître un **formulaire dynamique** construit à partir du `DescribeProcess` :
   données d'entrée (littérales, bbox, géométrie/complexe), choix du **format de sortie**.
3. **Exécuter** le processus (`Execute`) et exploiter le résultat (téléchargement, ou
   ajout d'une couche sur la carte quand la sortie est une couche WMS/un GeoJSON).

Le travail se découpe en deux briques :

- **`ogc-client`** : nouvel **endpoint WPS** (`WpsEndpoint`) calqué sur `WmsEndpoint` /
  `WfsEndpoint`, exposant `getProcesses()`, `describeProcess()`, `execute()`.
- **`viewer`** : UI Vue 3 / Nuxt UI (saisie URL + sélection processus, formulaire
  dynamique, exécution, intégration carte) qui consomme `WpsEndpoint`.

> Référence fonctionnelle : `analyses/wps.md` (reverse-engineering du client WPS de
> `sextant-geonetwork`). On reprend les concepts (DescribeProcess → formulaire,
> inputs literal/bbox/complex, sortie WMS rechargée comme couche) en les portant sur la
> stack moderne.

---

## Décisions & hypothèses (à valider)

- **Version WPS ciblée : 1.0.0.** C'est la version des services WPS historiques de Sextant
  (bindings `WPS_1_0_0` côté geonetwork) et la plus largement déployée (GeoServer, PyWPS,
  52°North). Le modèle `ogc-client` est conçu pour rester extensible vers WPS 2.0 (champ
  `version`, parseurs isolés), mais 2.0 est **hors périmètre** de ce plan.
- **`Execute` en POST XML** (et non KVP GET). C'est le mode robuste pour les entrées
  complexes (géométries), conforme à ce que faisait Sextant. Implique d'ajouter un helper
  HTTP POST dans `ogc-client` (voir A.6).
- **Réponse `Execute` en `ResponseDocument`** (avec `storeExecuteResponse`/`status` pour
  l'exécution asynchrone) plutôt que `RawDataOutput`, afin de pouvoir gérer le polling de
  statut et les sorties par référence.
- **Pas de jsonix.** `ogc-client` parse le XML avec `@rgrove/parse-xml` (lecture seule) ;
  la requête `Execute` est **générée par templating de chaînes** (échappement XML maîtrisé).
- **Pré-remplissage par filtres WFS / `applicationProfile`** (fonctions Sextant avancées) :
  **hors périmètre** de cette première version. On vise le cas générique « URL + process ».

---

# Partie A — `ogc-client` : `WpsEndpoint`

On reproduit fidèlement l'anatomie d'un endpoint existant. Modèle de référence :
`src/wms/endpoint.ts`, `src/wms/capabilities.ts`, `src/wms/url.ts`,
`src/wms/describelayer.ts`, `src/worker/worker.ts`, `src/worker/index.ts`, `src/index.ts`.

## A.1 Arborescence à créer

```
ogc-client/src/wps/
  endpoint.ts          # classe WpsEndpoint (API publique)
  model.ts             # types WPS (version, process summary/full, inputs, outputs, execute)
  capabilities.ts      # parseurs GetCapabilities (info, processes, operation urls, version)
  describeprocess.ts   # parseur DescribeProcess → WpsProcessFull
  execute.ts           # builder requête Execute (XML) + parseur ExecuteResponse
  url.ts               # generateDescribeProcessUrl / generateExecuteUrl (KVP de fallback)
  endpoint.spec.ts     # tests
  capabilities.spec.ts
  describeprocess.spec.ts
  execute.spec.ts
ogc-client/fixtures/wps/
  capabilities-*.xml
  describeprocess-*.xml
  execute-accepted-*.xml
  execute-succeeded-*.xml
  execute-failed-*.xml      # HTTP 200 + wps:ProcessFailed/ows:ExceptionReport imbriqué
  exception-report-*.xml    # rapport d'exception à la racine (requête malformée, 4xx)
```

## A.2 `model.ts` — types

```typescript
import { BoundingBox, CrsCode, GenericEndpointInfo, MimeType } from '../shared/models.js';

export type WpsVersion = '1.0.0'; // extensible: | '2.0.0'

/** Résumé d'un processus tel qu'exposé par GetCapabilities */
export interface WpsProcessSummary {
  identifier: string;
  title?: string;
  abstract?: string;
  processVersion?: string;
}

export type WpsInputType = 'literal' | 'boundingbox' | 'complex';

export interface WpsFormat {
  mimeType: MimeType;
  encoding?: string;
  schema?: string;
}

export interface WpsLiteralData {
  dataType?: string;            // ows:DataType (ex. 'float', 'string')
  defaultValue?: string;
  allowedValues?: string[];     // ows:AllowedValues/ows:Value
  anyValue?: boolean;
}

export interface WpsComplexData {
  default: WpsFormat;
  supported: WpsFormat[];
  maximumMegabytes?: number;
}

export interface WpsBoundingBoxData {
  defaultCrs: CrsCode;
  supportedCrs: CrsCode[];
}

export interface WpsProcessInput {
  identifier: string;
  title?: string;
  abstract?: string;
  minOccurs: number;
  maxOccurs: number;
  type: WpsInputType;
  literalData?: WpsLiteralData;
  complexData?: WpsComplexData;
  boundingBoxData?: WpsBoundingBoxData;
}

export interface WpsProcessOutput {
  identifier: string;
  title?: string;
  abstract?: string;
  type: WpsInputType;           // literal | complex | boundingbox
  literalData?: { dataType?: string };
  complexData?: WpsComplexData; // default + supported formats (choix du format de sortie)
}

export interface WpsProcessFull extends WpsProcessSummary {
  statusSupported: boolean;
  storeSupported: boolean;
  inputs: WpsProcessInput[];
  outputs: WpsProcessOutput[];
}

/** Valeur d'entrée fournie à execute() */
export interface WpsInputValue {
  identifier: string;
  // exactement l'un des trois selon le type d'input
  literalValue?: string;
  complexValue?: { mimeType: MimeType; content: string }; // ex. GML/GeoJSON
  boundingBoxValue?: { crs?: CrsCode; bbox: BoundingBox };
}

export interface WpsOutputSelection {
  identifier: string;
  mimeType?: MimeType;
  asReference?: boolean;
}

export interface WpsExecuteOptions {
  inputs: WpsInputValue[];
  outputs: WpsOutputSelection[];
  lineage?: boolean;
  storeExecuteResponse?: boolean;
  status?: boolean;
}

export type WpsExecuteStatus =
  | 'accepted' | 'started' | 'paused' | 'succeeded' | 'failed';

export interface WpsExecuteOutputResult {
  identifier: string;
  title?: string;
  // données inline OU référence (href) — l'un des deux
  data?: { mimeType?: MimeType; content: string };
  reference?: { href: string; mimeType?: MimeType };
}

export interface WpsExecuteResponse {
  status: WpsExecuteStatus;
  statusLocation?: string;          // pour le polling asynchrone
  percentCompleted?: number;
  outputs: WpsExecuteOutputResult[];
  // en cas d'échec : exception OWS (réutiliser ServiceExceptionError côté throw)
}

export type WpsEndpointInfo = GenericEndpointInfo;
```

## A.3 `capabilities.ts` — parseurs GetCapabilities

S'appuyer sur `src/shared/xml-utils.ts` (`getRootElement`, `findChildElement`,
`findChildrenElement`, `getElementText`, `getElementAttribute`, `stripNamespace`) et
réutiliser le pattern `parseOperation`/`readOperationUrlsFromCapabilities` de
`src/wms/capabilities.ts:165`.

Fonctions :

- `readVersionFromCapabilities(doc): WpsVersion` — `root.attributes.version`.
- `readInfoFromCapabilities(doc): WpsEndpointInfo` — `ows:ServiceIdentification`
  (Title/Abstract/Keywords/Fees/AccessConstraints) + `ows:ServiceProvider`
  (réutiliser le mapping `Provider`/`Contact`/`Address` partagé si présent dans WFS/WMS).
- `readOperationUrlsFromCapabilities(doc): Record<OperationName, OperationUrl>` —
  `ows:OperationsMetadata` → `ows:Operation[@name]` (`GetCapabilities`, `DescribeProcess`,
  `Execute`) → `ows:DCP/ows:HTTP/(ows:Get|ows:Post)[@xlink:href]`. Indispensable car
  l'URL d'`Execute` (POST) est souvent différente de l'URL de capabilities.
- `readProcessesFromCapabilities(doc): WpsProcessSummary[]` —
  `wps:ProcessOfferings/wps:Process` → `ows:Identifier`, `ows:Title`, `ows:Abstract`,
  `@wps:processVersion`.

## A.4 `describeprocess.ts` — parseur DescribeProcess

`parseDescribeProcessResponse(doc, processId): WpsProcessFull | null`

Naviguer `wps:ProcessDescriptions/ProcessDescription` (attributs `statusSupported`,
`storeSupported`), puis :

- **DataInputs** → `Input[]` : `ows:Identifier`, `ows:Title`, `@minOccurs`,
  `@maxOccurs` (« unbounded » → `Infinity`), et selon l'enfant présent :
  - `LiteralData` → `WpsLiteralData` (`ows:DataType`, `ows:AllowedValues/ows:Value[]`,
    `ows:AnyValue`, `DefaultValue`).
  - `ComplexData` → `WpsComplexData` (`Default/Format` + `Supported/Format[]` :
    `MimeType`, `Encoding`, `Schema` ; `@maximumMegabytes`).
  - `BoundingBoxData` → `WpsBoundingBoxData` (`Default/CRS`, `Supported/CRS[]`).
- **ProcessOutputs** → `Output[]` : idem, en `LiteralOutput` / `ComplexOutput`
  (Default/Supported Format → liste des formats de sortie sélectionnables) /
  `BoundingBoxOutput`.

## A.5 `execute.ts` — requête + réponse

**`buildExecuteRequest(process: WpsProcessFull, options: WpsExecuteOptions, version): string`**

Génère le XML `wps:Execute` par **templating de chaînes** (pas de lib de sérialisation :
`@rgrove/parse-xml` est lecture seule, et on ne veut pas alourdir la lib). Structure
cible (WPS 1.0.0) :

```xml
<wps:Execute service="WPS" version="1.0.0"
    xmlns:wps="http://www.opengis.net/wps/1.0.0"
    xmlns:ows="http://www.opengis.net/ows/1.1"
    xmlns:xlink="http://www.w3.org/1999/xlink">
  <ows:Identifier>{process.identifier}</ows:Identifier>
  <wps:DataInputs>
    <!-- pour chaque WpsInputValue, selon le type de l'input correspondant -->
    <wps:Input>
      <ows:Identifier>{id}</ows:Identifier>
      <wps:Data>
        <wps:LiteralData>{literalValue}</wps:LiteralData>
        <!-- ou -->
        <wps:ComplexData mimeType="{mime}">{contenu brut}</wps:ComplexData>
        <!-- ou -->
        <wps:BoundingBoxData crs="{crs}" dimensions="2">
          <ows:LowerCorner>{minx} {miny}</ows:LowerCorner>
          <ows:UpperCorner>{maxx} {maxy}</ows:UpperCorner>
        </wps:BoundingBoxData>
      </wps:Data>
    </wps:Input>
  </wps:DataInputs>
  <wps:ResponseForm>
    <wps:ResponseDocument storeExecuteResponse="{store}" lineage="{lineage}" status="{status}">
      <!-- pour chaque WpsOutputSelection -->
      <wps:Output asReference="{asReference}" mimeType="{mime}">
        <ows:Identifier>{output.identifier}</ows:Identifier>
      </wps:Output>
    </wps:ResponseDocument>
  </wps:ResponseForm>
</wps:Execute>
```

> Reprendre la logique de `printExecuteMessage` de Sextant
> (`analyses/wps.md` §3) pour le mapping des trois types d'entrées et la sélection de
> sortie.

### Échappement XML

**Une seule** fonction d'échappement, `escapeXml(s)`, qui couvre les 5 caractères XML
(`& < > " '`). Le même jeu de caractères convient au **contenu texte** comme aux **valeurs
d'attribut** (échapper les guillemets dans du texte est inoffensif) — inutile d'avoir deux
variantes. Elle s'applique à **toutes** les valeurs interpolées : identifiants, valeurs
littérales, mimeTypes, CRS, coordonnées de bbox, drapeaux booléens. **Exception** : le
contenu complexe (`ComplexData`) n'est *pas* traité comme une valeur littérale — son
échappement dépend du `mimeType` (insertion brute, CDATA, ou `escapeXml` en repli ; voir
« Contenu complexe » ci-dessous).

La structure cible ci-dessus montre les **trous** (`{id}`, `{literalValue}`, `{mime}`…) mais
*pas* l'échappement. La vraie question n'est pas *quoi* échapper (toujours `escapeXml`) mais
*où* l'appeler. Deux options produisent **exactement le même XML** ; seul change l'endroit
où l'échappement vit. Le plan retient l'**option B** (~20 lignes de helpers, supprime le
risque d'oubli), mais l'option A reste acceptable si on préfère la simplicité brute.

`escapeXml` est commun aux deux options :

```typescript
const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!))
```

**Option A — échappement à la main.** On remplit la structure cible directement en
template-strings, en appelant `escapeXml` à *chaque* interpolation (contenu **et** attribut) :

```typescript
const literalInput = `<wps:Input>
  <ows:Identifier>${escapeXml(id)}</ows:Identifier>
  <wps:Data><wps:LiteralData>${escapeXml(literalValue)}</wps:LiteralData></wps:Data>
</wps:Input>`

const complexInput = `<wps:Input>
  <ows:Identifier>${escapeXml(id)}</ows:Identifier>
  <wps:Data><wps:ComplexData mimeType="${escapeXml(mime)}">${complexBody}</wps:ComplexData></wps:Data>
</wps:Input>`

const bboxInput = `<wps:Input>
  <ows:Identifier>${escapeXml(id)}</ows:Identifier>
  <wps:Data><wps:BoundingBoxData crs="${escapeXml(crs)}" dimensions="2">
    <ows:LowerCorner>${escapeXml(`${minx} ${miny}`)}</ows:LowerCorner>
    <ows:UpperCorner>${escapeXml(`${maxx} ${maxy}`)}</ows:UpperCorner>
  </wps:BoundingBoxData></wps:Data>
</wps:Input>`
// ⚠ chaque ${…} doit porter escapeXml ; en oublier un seul casse potentiellement le XML.
//   (complexBody = contenu déjà traité selon le mimeType — cf. « Contenu complexe » ci-dessous)
```

**Option B — échappement par construction (retenue).** Trois helpers privés au module
appellent `escapeXml` en interne ; on ne peut donc plus l'oublier :

```typescript
const el = (tag: string, attrs: Record<string, string | undefined>, children = '') => {
  const a = Object.entries(attrs)
    .filter(([, v]) => v != null)
    .map(([k, v]) => ` ${k}="${escapeXml(v!)}"`).join('')   // ← attributs échappés ici
  return children === '' ? `<${tag}${a}/>` : `<${tag}${a}>${children}</${tag}>`
}
const text = (tag: string, value: string) => el(tag, {}, escapeXml(value)) // ← contenu échappé ici
const cdata = (raw: string) => `<![CDATA[${raw.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
```

Les *mêmes* trois fragments, composés avec les helpers (plus aucun `escapeXml` à la main) :

```typescript
const literalInput = el('wps:Input', {},
  text('ows:Identifier', id) +
  el('wps:Data', {}, text('wps:LiteralData', literalValue)))

const complexInput = el('wps:Input', {},
  text('ows:Identifier', id) +
  el('wps:Data', {}, el('wps:ComplexData', { mimeType: mime }, complexBody)))

const bboxInput = el('wps:Input', {},
  text('ows:Identifier', id) +
  el('wps:Data', {}, el('wps:BoundingBoxData', { crs, dimensions: '2' },
    text('ows:LowerCorner', `${minx} ${miny}`) +
    text('ows:UpperCorner', `${maxx} ${maxy}`))))
```

…et l'enveloppe `wps:Execute` complète se compose de la même façon (namespaces = attributs
du nœud racine) :

```typescript
const responseForm = el('wps:ResponseForm', {},
  el('wps:ResponseDocument',
    {
      storeExecuteResponse: String(options.storeExecuteResponse ?? false),
      lineage: String(options.lineage ?? false),
      status: String(options.status ?? false),
    },
    options.outputs.map(output =>
      el('wps:Output',
        { asReference: String(output.asReference ?? false), mimeType: output.mimeType },
        text('ows:Identifier', output.identifier))).join('')))

return `<?xml version="1.0" encoding="UTF-8"?>` +
  el('wps:Execute',
    {
      service: 'WPS',
      version,
      'xmlns:wps': 'http://www.opengis.net/wps/1.0.0',
      'xmlns:ows': 'http://www.opengis.net/ows/1.1',
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
    },
    text('ows:Identifier', process.identifier) +
    el('wps:DataInputs', {}, inputs.join('')) +   // inputs = [literalInput, complexInput, bboxInput, …]
    responseForm)
```

### Contenu complexe (`ComplexData`)

Le `complexValue.content` (GeoJSON/WKT/GML collé par l'utilisateur, cf. B.4 `WpsInputField`)
est le seul cas délicat : il ne se traite **ni** comme une valeur littérale (pas
d'`escapeXml`) **ni** uniformément. Le traitement dépend du `mimeType` :

| `mimeType` du contenu | Traitement | Raison |
|---|---|---|
| XML (GML : `application/gml+xml`, `text/xml`, `…/gml`) | **insertion brute**, sans escaping ni CDATA | on embarque du XML dans du XML ; l'échapper le transformerait en simple texte côté serveur |
| non-XML (GeoJSON `application/json`, WKT, CSV…) | **CDATA** (ou à défaut `escapeXml`) | un `<` ou `&` dans le contenu casserait le XML sinon |

> Heuristique de décision : tester si le `mimeType` matche `/xml|gml/` → insertion brute,
> sinon `cdata()`. À documenter en JSDoc sur `WpsInputValue.complexValue.content`
> (« contenu brut ; enveloppé en CDATA si non-XML »). Aucun impact sur les types publics
> (`content: string` inchangé) — c'est une clarification de contrat, pas une rupture d'API.

**`parseExecuteResponse(doc): WpsExecuteResponse`**

- Si racine = `ows:ExceptionReport` → `check()`/`ServiceExceptionError`
  (`src/shared/errors.ts`) pour lever une erreur typée.
- Sinon `wps:ExecuteResponse` :
  - `@statusLocation` → `statusLocation`.
  - `wps:Status` → `accepted|started|paused|succeeded|failed` (+ `percentCompleted`).
  - **Attention** : en WPS 1.0.0 un échec arrive en **HTTP 200** avec
    `wps:Status/wps:ProcessFailed/ows:ExceptionReport` imbriqué — `check()` à la racine ne le
    voit pas. Détecter ce cas et lever un `ServiceExceptionError` (réutiliser `parse()`,
    `src/shared/errors.ts:54`, sur l'`ows:Exception` interne).
  - `wps:ProcessOutputs/Output[]` → `wps:Data` (inline) ou `wps:Reference[@href,@mimeType]`.

## A.6 Helper HTTP POST (shared)

`queryXmlDocument` est **GET-only** (`src/shared/http-utils.ts:44`). Ajouter :

```typescript
// src/shared/http-utils.ts
export function postXmlDocument(url: string, body: string): Promise<XmlDocument> {
  // fetch POST, Content-Type: application/xml, ...getFetchOptions()
  // même gestion d'erreurs/décodage que queryXmlDocument, puis parseXmlString
}
```

(Ne pas passer par `sharedFetch`, prévu pour GET/HEAD idempotents.) Réutiliser
`decodeString` et la gestion `EndpointError`/CORS de `queryXmlDocument`.

> **Proxy CORS.** L'URL `Execute` vient de `getOperationUrl('Execute','Post')`, soit le
> `xlink:href` **brut** des capabilities → URL directe, sans préfixe proxy. Si l'endpoint a
> été créé avec une URL proxifiée (forme `…/https%3A%2F%2F…`, cf. `setQueryParams` l.135),
> le POST direct contournera le proxy et échouera en CORS. Avant de POSTer, `execute()` doit
> réappliquer le préfixe proxy de `_capabilitiesUrl` à l'URL d'opération (même remarque pour
> l'URL `DescribeProcess`). Détailler le helper de re-proxy à l'implémentation.

## A.7 `endpoint.ts` — la classe

Calquer `src/wms/endpoint.ts:25-120`.

```typescript
export default class WpsEndpoint {
  private _capabilitiesUrl: string;
  private _capabilitiesPromise: Promise<void>;
  private _info: WpsEndpointInfo | null;
  private _processes: WpsProcessSummary[] | null;
  private _url: Record<OperationName, OperationUrl>;
  private _version: WpsVersion | null;

  constructor(url: string) {
    this._capabilitiesUrl = setQueryParams(url, {
      SERVICE: 'WPS', REQUEST: 'GetCapabilities',
    });
    this._capabilitiesPromise = useCache(
      () => parseWpsCapabilities(this._capabilitiesUrl),
      'WPS', 'CAPABILITIES', this._capabilitiesUrl
    ).then(({ info, processes, url, version }) => {
      this._info = info; this._processes = processes;
      this._url = url; this._version = version;
    });
  }

  isReady() { return this._capabilitiesPromise.then(() => this); }
  getServiceInfo() { return this._info; }
  getVersion() { return this._version; }
  getProcesses() { return this._processes; }
  getProcessSummary(id) { /* lookup dans _processes */ }
  getOperationUrl(name, method = 'Get') { /* comme WMS getOperationUrl */ }
  getCapabilitiesUrl() { return this._capabilitiesUrl; }

  // DescribeProcess (cache, comme WmsEndpoint.describeLayer)
  describeProcess(processId: string): Promise<WpsProcessFull> {
    const url = generateDescribeProcessUrl(
      this.getOperationUrl('DescribeProcess'), this._version, processId);
    return useCache(
      () => queryXmlDocument(url).then(d => parseDescribeProcessResponse(d, processId)),
      'WPS', 'DESCRIBEPROCESS', this._capabilitiesUrl, processId);
  }

  // Execute (POST XML) ; nécessite la description du process pour typer les inputs
  async execute(processId, options: WpsExecuteOptions): Promise<WpsExecuteResponse> {
    const process = await this.describeProcess(processId);
    const body = buildExecuteRequest(process, options, this._version);
    const executeUrl = this.getOperationUrl('Execute', 'Post');
    return postXmlDocument(executeUrl, body).then(parseExecuteResponse);
  }

  // Polling de statut pour exécution asynchrone
  getStatus(statusLocation: string): Promise<WpsExecuteResponse> {
    return queryXmlDocument(statusLocation).then(parseExecuteResponse);
  }
}
```

## A.8 Worker

- `src/worker/worker.ts` : ajouter le handler `parseWpsCapabilities` sur le modèle de
  `parseWmsCapabilities` (`queryXmlDocument(url) → check(doc, url) → { info, processes,
  url, version }`).
- `src/worker/index.ts` : exporter `parseWpsCapabilities(url)`.
- `src/worker-fallback/index.ts` : ajouter le fallback no-worker correspondant.

> `DescribeProcess` et `Execute` peuvent rester hors worker (comme `describeLayer`), car ce
> sont des requêtes ponctuelles à la demande.

## A.9 Exports publics — `src/index.ts`

```typescript
export { default as WpsEndpoint } from './wps/endpoint.js';
export type {
  WpsVersion, WpsProcessSummary, WpsProcessFull, WpsProcessInput, WpsProcessOutput,
  WpsLiteralData, WpsComplexData, WpsBoundingBoxData, WpsFormat,
  WpsInputValue, WpsOutputSelection, WpsExecuteOptions, WpsExecuteResponse,
  WpsExecuteOutputResult, WpsExecuteStatus, WpsEndpointInfo,
} from './wps/model.js';
export { postXmlDocument } from './shared/http-utils.js'; // si exposition souhaitée
```

## A.10 Tests & fixtures

- Mocker `useCache` (`jest.fn(factory => factory())`) comme `src/wms/endpoint.spec.ts`.
- `globalThis.fetchResponseFactory` renvoie les fixtures XML selon l'URL/REQUEST.
- Fixtures réalistes : récupérer un `GetCapabilities` + `DescribeProcess` d'un WPS Sextant
  réel (ou GeoServer/PyWPS) et les déposer dans `fixtures/wps/`.
- Cas de test : `isReady` fait bien `?SERVICE=WPS&REQUEST=GetCapabilities` ; `getProcesses`
  liste les process ; `describeProcess` mappe inputs/outputs (literal+allowedValues, bbox,
  complex multi-formats) ; `buildExecuteRequest` produit le XML attendu (snapshot) ;
  `parseExecuteResponse` gère succeeded inline / reference / accepted+statusLocation /
  ExceptionReport / `ProcessFailed` imbriqué (HTTP 200) → lève `ServiceExceptionError`.
- **Échappement XML** : prévoir quelques tests d'injection sur `buildExecuteRequest`
  (valeur littérale et attribut contenant `< > " &`, contenu complexe contenant `]]>`) ;
  vérifier que le XML reste bien formé et que la valeur survit au round-trip. Détailler au
  moment de l'implémentation.

---

# Partie B — `viewer` : UI Vue 3 / Nuxt UI

> Conventions imposées (`viewer/CLAUDE.md`) : `<script setup>` + Composition API, Pinia en
> *setup style*, **Nuxt UI 4** pour toute l'UI, Tailwind 4, pas de semicolons, strings en
> **français**. Nommage : `PascalCase.vue`, `useCamelCase.ts`, `name.store.ts`.
> **Skills disponibles** (sous `viewer/`) : `ogc-client` (découverte/chargement de services)
> et `geospatial-sdk` (intégration carte / MapContext) — les invoquer pendant l'implémentation.

## B.1 Dépendance

Le `viewer` épingle `@camptocamp/ogc-client@1.3.1-dev.<hash>`. Une fois `WpsEndpoint`
publié, **bumper la version** d'`ogc-client` dans `viewer/package.json`. En développement
local, on peut lier la lib (`npm link` / override) le temps d'itérer.

## B.2 Fichiers à créer

```
viewer/src/
  composables/useWps.ts            # logique : capabilities, describe, execute, → carte
  components/wps/
    WpsPanel.vue                   # conteneur : URL + sélection process + form + exécution
    WpsProcessForm.vue             # formulaire dynamique (inputs + format sortie)
    WpsInputField.vue              # rendu d'un input selon son type
    WpsExecuteResult.vue           # affichage résultat (download / statut / erreur)
  types/wps.types.ts               # types UI (état du formulaire) — réutiliser ceux d'ogc-client
```

## B.3 `useWps.ts` — composable

Sur le modèle de `useAddLayer.ts` / `useStacLayer.ts` (logique métier + accès `mapStore`).

```typescript
import { WpsEndpoint } from '@camptocamp/ogc-client'
import { useMapStore } from '@/stores/map.store'

export function useWps() {
  const mapStore = useMapStore()

  async function loadProcesses(url: string) {
    const endpoint = await new WpsEndpoint(url).isReady()
    return { endpoint, processes: endpoint.getProcesses() }
  }

  async function describe(endpoint: WpsEndpoint, processId: string) {
    return endpoint.describeProcess(processId)
  }

  async function execute(endpoint, processId, options) {
    let response = await endpoint.execute(processId, options)
    // exécution asynchrone : polling tant que accepted/started/paused
    while (response.statusLocation &&
           ['accepted', 'started', 'paused'].includes(response.status)) {
      await delay(1000)
      response = await endpoint.getStatus(response.statusLocation)
    }
    if (response.status === 'succeeded') addResultToMap(response)
    return response
  }

  function addResultToMap(response) {
    // sortie référence WMS → couche 'wms' ; GeoJSON inline/href → couche 'geojson'
    // construire un MapContextLayer et appeler mapStore.addLayer(layer)
  }

  return { loadProcesses, describe, execute }
}
```

**Intégration carte (sortie en couche)** — cf. `analyses/wps.md` §3 (sortie WMS rechargée) :

- `reference.mimeType` ~ `ogc-wms` → l'`href` est un `GetCapabilities` WMS → créer un
  `MapContextLayer` `{ type: 'wms', url, name }` et `mapStore.addLayer(layer, true)`
  (geospatial-sdk instancie l'endpoint, cf. skill `geospatial-sdk`).
- sortie GeoJSON (inline `data.content` ou `reference.href`) → couche `{ type: 'geojson',
  url | data }`.
- sinon → simple lien de **téléchargement** (`reference.href`) dans `WpsExecuteResult.vue`.

Réutiliser `useAddLayer` / `mapStore.addLayer` (enrichissement UUID + version + persistance
automatique via `persistentContext.store`).

## B.4 Composants

### `WpsPanel.vue` (conteneur)
État : `url`, `endpoint`, `processes`, `selectedProcess` (= `WpsProcessFull` après
`describe`), `executing`, `result`.
UI Nuxt UI (cf. `AddDataPanel.vue`) :
- `UFormField` + `UFieldGroup` + `UInput` (URL, debounced) + `UButton` « Charger ».
- `USelect` listant les process (`getProcesses()`), → au choix, appel `describe()`.
- `<WpsProcessForm :process="selectedProcess" v-model:inputs="inputs"
   v-model:output="output" @execute="onExecute" />`.
- `<WpsExecuteResult :result="result" />`.

### `WpsProcessForm.vue` (formulaire dynamique)
`v-for` sur `process.inputs` → un `<WpsInputField>` par entrée (gérer `minOccurs`/
`maxOccurs` : ajout/suppression de valeurs, comme Sextant). Puis sélecteur de **format de
sortie** : `USelect` alimenté par `output.complexData.supported` (mimeTypes). Bouton
`UButton` « Exécuter » (désactivé si invalide / `executing`). Émet `update:inputs`,
`update:output`, `execute`. S'inspirer de `StacFilterPanel.vue` (computed + emit).

### `WpsInputField.vue` (rendu d'un input)
Rendu conditionnel selon `input.type` :
- `literal` + `allowedValues` → `USelect` ; sinon `UInput` (`type=number` si
  `dataType === 'float'`/`'double'`/`'integer'`, sinon `text`). Valeur par défaut =
  `literalData.defaultValue`.
- `boundingbox` → composant de saisie d'emprise (réutiliser l'emprise courante de la carte
  via `mapStore.currentExtent`, ou un futur outil de dessin de bbox).
- `complex` (géométrie) → v1 : `UTextarea` (coller du GeoJSON/WKT) ; v2 : outil de dessin
  sur carte (équivalent `gn-geometry-tool`, à ouvrir comme évolution).

### `WpsExecuteResult.vue`
- `succeeded` : pour chaque output, lien `UButton`/`a` de téléchargement (`reference.href`),
  ou message « couche ajoutée à la carte » si traitée par `addResultToMap`.
- `accepted/started/paused` : indicateur de progression (`percentCompleted`).
- `failed` / exception : afficher le message OWS (`ServiceExceptionError`).

## B.5 Intégration dans le layout

Ajouter un onglet « Traitements (WPS) » dans `viewer/src/components/layout/LayerPanel.vue`
(pattern `UTabs` existant) pointant vers `<WpsPanel />` ; ou un bouton dans
`ToolsPanel.vue` / `AddDataPanel.vue`. **Aucune modale n'existe encore** dans le viewer : on
reste sur un **panneau intégré** (cohérent avec l'existant) plutôt qu'`UModal`.

---

## Découpage en étapes (PR)

1. **ogc-client / modèle + parsing GetCapabilities** : `model.ts`, `capabilities.ts`,
   `url.ts`, `endpoint.ts` (`isReady`/`getProcesses`/`getServiceInfo`), worker, exports,
   tests + fixtures capabilities. *(Livrable testable isolément.)*
2. **ogc-client / DescribeProcess** : `describeprocess.ts`, `WpsEndpoint.describeProcess`,
   tests + fixtures describe.
3. **ogc-client / Execute** : `postXmlDocument`, `execute.ts` (build + parse),
   `WpsEndpoint.execute`/`getStatus`, tests + fixtures execute (succeeded/reference/
   accepted/exception). Publier la version.
4. **viewer / lecture** : bump ogc-client, `useWps` (load + describe), `WpsPanel` +
   `WpsProcessForm` + `WpsInputField` (literal/bbox/complex-textarea), sélection format de
   sortie. Onglet dans `LayerPanel`.
5. **viewer / exécution + carte** : `useWps.execute` + polling, `WpsExecuteResult`,
   `addResultToMap` (WMS/GeoJSON via `mapStore.addLayer`), gestion erreurs.
6. **(évolutions)** : dessin de bbox/géométrie sur carte, pré-remplissage
   `applicationProfile`, WPS 2.0.

## Tests / validation

- **ogc-client** : `jest` (specs ci-dessus). Lancer `npm test` dans `ogc-client/`.
- **viewer** : `vitest` (composables/composants), `playwright` (e2e : saisir une URL WPS de
  démo, choisir un process, exécuter, vérifier l'ajout de couche). Respecter `npm run lint`
  / `type-check` / `format:check`.
- **Bout en bout manuel** : viser un WPS Sextant/GeoServer réel ; vérifier inputs literal +
  allowedValues, sortie WMS rechargée en couche, et un cas asynchrone (status polling).

## Risques & points ouverts

- **CORS** : un service WPS tiers peut bloquer le POST `Execute` depuis le navigateur ;
  prévoir éventuellement le proxy déjà utilisé par le viewer/ogc-client (`setFetchOptions`).
- **Hétérogénéité des serveurs WPS 1.0.0** (GeoServer vs PyWPS vs 52°North) sur les
  namespaces/casse → parsing tolérant (`stripNamespace`, recherche d'enfants imbriqués).
- **Version WPS** : décision « 1.0.0 » à confirmer (cf. hypothèses). Si des services 2.0
  doivent être supportés, prévoir des parseurs/versions séparés (impact étape 1-3).
- **Inputs complexes (géométrie)** : v1 en textarea ; l'UX « dessin sur carte » est une
  évolution non triviale (équivalent `gn-geometry-tool`).
```
