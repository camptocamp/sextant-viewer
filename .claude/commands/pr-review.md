Fais une review de la PR courante (diff depuis main) en te concentrant sur ces critères propres au projet :

## 1. Documentation
- L'API publique de `SxtViewer.ce.vue` a-t-elle été modifiée (méthodes, events, props) ? Si oui, le changement est-il documenté quelque part (README, commentaire JSDoc, fichier de doc) ?
- Des comportements existants ont-ils changé de façon visible pour un intégrateur ? Si oui, un `CHANGELOG.md` ou une note de migration est-elle présente ?
- Des nouveaux composables, stores ou utils publics ont-ils été ajoutés sans description de leur rôle dans `CLAUDE.md` (section Architecture ou Project Structure) ?

## 2. Cohérence architecturale
- Les modifications de l'état de la carte passent-elles par `map.store.ts` et `ExtendedMapContext` ?
- Les mises à jour de state sont-elles immutables (`{ ...context.value, ... }`) ?
- Les type guards `isStacLayer()` / `isBasemapLayer()` sont-ils utilisés au lieu de vérifier `.type` inline ?
- L'API publique de `SxtViewer.ce.vue` (`defineExpose`) est-elle cohérente avec les changements ?

## 2. UI / composants
- Les nouveaux éléments UI utilisent-ils NuxtUI (`@nuxt/ui`) ?
- Les textes utilisateurs sont-ils en **français** (convention du projet) ?
- Les erreurs utilisateurs passent-elles par `Toast`/`Alert` NuxtUI ?

## 4. Tests
- Les nouvelles fonctionnalités visibles (interactions map, layer manager, STAC) ont-elles un test E2E Playwright dans `e2e/` ?
- Les bugfixes ont-ils un test qui reproduit la régression ?

## 5. Web component / Shadow DOM
- Les changements de style tiennent-ils compte du shadow DOM (`register.ts`, styles inlinés) ?

## 6. Qualité générale
- Pas de commentaires "quoi" — seulement "pourquoi" si non évident
- Pas de références à des tickets (US1, T024) dans le code
- Typage TypeScript strict respecté

Ne remonte pas les problèmes de style mineurs (Prettier/ESLint s'en chargent). Concentre-toi sur ce qui bloque la PR ou crée une dette architecturale.
