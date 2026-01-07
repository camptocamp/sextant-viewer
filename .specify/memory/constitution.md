<!--
SYNC IMPACT REPORT - Constitution v1.1.0

VERSION CHANGE: 1.0.0 → 1.1.0

RATIONALE: MINOR version bump - adding new principle (NuxtUI Component Library Standard)
that introduces mandatory UI component constraints without breaking existing governance.

MODIFIED PRINCIPLES: None (existing principles unchanged)

ADDED SECTIONS:
- Core Principles > VIII. NuxtUI Component Library Standard
- Updated Technology Stack Constraints to reference NuxtUI component categories

REMOVED SECTIONS: None

TEMPLATES REQUIRING UPDATES:
✅ .specify/templates/plan-template.md - Constitution Check section will validate NuxtUI usage
✅ .specify/templates/spec-template.md - Requirements section will reference UI component standards
✅ .specify/templates/tasks-template.md - Task organization will include UI component implementation validation

FOLLOW-UP TODOS: None

AMENDMENT DATE: 2026-01-07
-->

# Sextant Viewer Constitution

## Core Principles

### I. MapContext as Source of Truth

**MUST** use geospatial-sdk MapContext as the single source of truth for all map state. All map operations **MUST** flow through the MapContext stored in Pinia. Direct manipulation of the OpenLayers map instance **MUST** be avoided unless technically impossible through the geospatial-sdk API.

**Implementation Requirements**:
- MapContext stored in Pinia store with immutable update patterns
- Map changes propagate through `computeMapContextDiff()` and `applyContextDiffToMap()`
- Bidirectional synchronization with circular update prevention
- Map instance stored separately for imperative API access only when necessary

**Rationale**: The geospatial-sdk MapContext pattern ensures state consistency, enables change detection, supports serialization for persistence/sharing, and provides a framework-agnostic abstraction over map libraries.

### II. Vue.js Best Practices

**MUST** follow official Vue 3 Composition API patterns and best practices. Components **MUST** use `<script setup>` syntax. State management **MUST** use Pinia with the Composition API style (`defineStore` with setup function). Reactivity **MUST** use `ref()` and `computed()` appropriately.

**Implementation Requirements**:
- Use `<script setup>` for all components
- Use Pinia stores with Composition API (`defineStore` returning setup function)
- Proper reactive dependencies in `watch()` and `computed()`
- Component props typed with `defineProps<T>()`
- Avoid Options API patterns

**Rationale**: Composition API provides better TypeScript integration, improved code organization through composables, and aligns with modern Vue 3 development standards.

### III. Clean Code & SOLID Principles

**MUST** adhere to clean code principles and SOLID design patterns. Code **MUST** be self-documenting with clear naming. Functions **MUST** have single responsibilities. Components **MUST** follow single responsibility principle. Abstractions **MUST** be justified by actual need, not speculation.

**Implementation Requirements**:
- Functions ≤ 20 lines (exceptions must be justified)
- Clear, descriptive naming (no abbreviations except well-known acronyms)
- Single Responsibility: each function/component does one thing
- Dependency Inversion: depend on abstractions (composables, stores) not concrete implementations
- No premature abstraction - follow the rule of three

**Rationale**: Clean code and SOLID principles improve maintainability, reduce cognitive load, facilitate testing, and enable safe refactoring.

### IV. Component Architecture

**MUST** maintain atomic component structure with clear separation of concerns. Components **MUST** be organized by feature/domain. Presentation components **MUST** be separated from container components. Component size **MUST** be limited to ≤ 200 lines including template (exceptions require justification).

**Implementation Requirements**:
- Atomic design structure: atoms → molecules → organisms
- Feature-based directory organization (`components/map/`, `components/layer/`)
- Presentational components receive data via props, emit events upward
- Container components connect to stores, manage side effects
- Composables extract reusable logic (`useMapInteraction`, `useLayerManagement`)
- Maximum component size: 200 lines (template + script + style)

**Rationale**: Atomic architecture enhances reusability, simplifies testing, improves code navigation, and enables parallel development.

### V. TypeScript-First Development

**MUST** use TypeScript for all code with strict type checking enabled. Type safety **MUST** not be bypassed with `any` without explicit justification. Types **MUST** be imported from authoritative sources (geospatial-sdk types, OpenLayers types). Type assertions **MUST** use `as unknown as T` pattern for intentional type conversions.

**Implementation Requirements**:
- `strict: true` in TypeScript configuration
- Explicit type annotations for function parameters and return types
- Import types from `@geospatial-sdk/core`, `ol`, and framework packages
- Use `type` imports for type-only imports (tree-shaking)
- Document `any` usage with inline comments explaining necessity
- Use type guards for runtime type validation

**Rationale**: TypeScript prevents runtime errors, improves IDE support, serves as living documentation, and enables safe refactoring through compile-time checks.

### VI. Geospatial-SDK Integration

**MUST** leverage geospatial-sdk utilities and patterns before implementing custom solutions. Layer management **MUST** use geospatial-sdk layer types (`MapContextLayer`). Map initialization **MUST** use `createMapFromContext()`. Change detection **MUST** use `computeMapContextDiff()`.

**Implementation Requirements**:
- Use `createMapFromContext()` for map initialization
- Use `applyContextDiffToMap()` for applying state changes
- Use `computeMapContextDiff()` for change detection
- Prefer geospatial-sdk layer types over custom layer implementations
- Consult geospatial-sdk documentation before adding custom map logic
- Use geospatial-sdk utilities: `createViewFromLayer`, etc.

**Rationale**: Geospatial-sdk provides tested abstractions, ensures consistency across applications, reduces custom code maintenance, and enables interoperability.

### VII. Software Craftsmanship

**MUST** demonstrate software craftsmanship through code quality, testing discipline, and continuous improvement. Code reviews **MUST** verify adherence to constitution principles. Technical debt **MUST** be documented and tracked. Complexity **MUST** be justified against simpler alternatives.

**Implementation Requirements**:
- ESLint + Prettier configured and enforced
- Code review checklist includes constitution compliance
- Technical debt tracked with TODO comments including context
- No commented-out code in production
- Refactoring as part of feature work (Boy Scout Rule)
- Performance optimization only when measured need exists

**Rationale**: Craftsmanship ensures long-term maintainability, reduces defects, builds team expertise, and creates sustainable development velocity.

### VIII. NuxtUI Component Library Standard

**MUST** use NuxtUI components from `@nuxt/ui` for all user interface elements. Custom UI components **MUST NOT** be created when equivalent NuxtUI components exist. UI consistency **MUST** be maintained through exclusive use of NuxtUI's design system.

**Implementation Requirements**:
- All buttons **MUST** use `<UButton>` component
- All forms **MUST** use NuxtUI form components (`<UInput>`, `<USelect>`, `<UCheckbox>`, etc.)
- All overlays **MUST** use NuxtUI overlay components (`<UModal>`, `<UTooltip>`, `<UDrawer>`, etc.)
- All navigation **MUST** use NuxtUI navigation components (`<UBreadcrumb>`, `<UTabs>`, `<UPagination>`, etc.)
- All data display **MUST** use NuxtUI data components (`<UTable>`, `<UCard>`, `<UAccordion>`, etc.)
- Layout components **MUST** use NuxtUI layout system (`<UContainer>`, `<UHeader>`, `<UFooter>`, etc.)
- Custom components **MAY** wrap or extend NuxtUI components but **MUST NOT** replicate their functionality
- Consult NuxtUI documentation (https://ui.nuxt.com/docs/components) before creating any UI component

**Available NuxtUI Component Categories** (125+ components):
- **Layout** (6): App, Container, Error, Footer, Header, Main
- **Element** (18): Alert, Avatar, AvatarGroup, Badge, Banner, Button, Calendar, Card, Chip, Collapsible, FieldGroup, Icon, Kbd, Progress, Separator, Skeleton
- **Form** (23): Checkbox, CheckboxGroup, ColorPicker, FileUpload, Form, FormField, Input, InputDate, InputMenu, InputNumber, InputTags, InputTime, PinInput, RadioGroup, Select, SelectMenu, Slider, Switch, Textarea
- **Data** (10): Accordion, Carousel, Empty, Marquee, ScrollArea, Table, Timeline, Tree, User
- **Navigation** (8): Breadcrumb, CommandPalette, FooterColumns, Link, NavigationMenu, Pagination, Stepper, Tabs
- **Overlay** (10): ContextMenu, Drawer, DropdownMenu, Modal, Popover, Slideover, Toast, Tooltip
- **Page** (27): AuthForm, BlogPost, BlogPosts, ChangelogVersion, ChangelogVersions, Page, PageAnchors, PageAside, PageBody, PageCard, PageColumns, PageCTA, PageFeature, PageGrid, PageHeader, PageHero, PageLinks, PageList, PageLogos, PageSection, PricingPlan, PricingPlans, PricingTable
- **Dashboard** (10): DashboardGroup, DashboardNavbar, DashboardPanel, DashboardResizeHandle, DashboardSearch, DashboardSearchButton, DashboardSidebar, DashboardSidebarCollapse, DashboardSidebarToggle, DashboardToolbar
- **AI Chat** (5): ChatMessage, ChatMessages, ChatPalette, ChatPrompt, ChatPromptSubmit
- **Editor** (6): Editor, EditorDragHandle, EditorEmojiMenu, EditorMentionMenu, EditorSuggestionMenu, EditorToolbar
- **Content** (5): ContentNavigation, ContentSearch, ContentSearchButton, ContentSurround, ContentToc
- **Color Mode** (5): ColorModeAvatar, ColorModeButton, ColorModeImage, ColorModeSelect, ColorModeSwitch
- **i18n** (1): LocaleSelect

**Rationale**: Standardizing on NuxtUI ensures visual consistency, reduces maintenance burden, leverages battle-tested accessible components (WAI-ARIA compliant), provides integrated Tailwind CSS styling, and enables rapid development through comprehensive component coverage.

## Technology Stack Constraints

### Required Technologies

**MUST** use the following core technologies:
- **Frontend Framework**: Vue.js 3.5+ with Composition API
- **UI Component Library**: NuxtUI 4.3+ (125+ components)
- **State Management**: Pinia 3.0+
- **Build Tool**: Vite 7.0+
- **Map Library**: OpenLayers 10.0+ via geospatial-sdk
- **Geospatial Abstraction**: @geospatial-sdk/core and @geospatial-sdk/openlayers
- **Styling**: Tailwind CSS 4.0+
- **Type System**: TypeScript 5.9+ with strict mode

### Optional Technologies

**MAY** introduce the following when justified:
- **Testing**: Vitest for unit/integration tests (when testing strategy defined)
- **OGC Integration**: @camptocamp/ogc-client for WMS/WMTS/WFS layer loading
- **Additional Libraries**: Must be justified, documented, and approved in plan phase

### Technology Introduction Process

Before introducing new dependencies:
1. Document the specific problem being solved
2. Evaluate existing solutions in current stack (especially NuxtUI for UI components)
3. Justify why current stack is insufficient
4. Consider bundle size and maintenance implications
5. Obtain approval in implementation plan review

## Code Quality Standards

### File Organization

```
src/
├── components/          # Vue components organized by feature
│   ├── map/            # Map-related components
│   ├── layer/          # Layer management components
│   ├── stac/           # STAC browser components
│   └── common/         # Shared presentational components (wrapping NuxtUI)
├── composables/        # Reusable logic hooks
│   ├── useMapInteraction.ts
│   ├── useMapView.ts
│   └── useLayerManagement.ts
├── stores/             # Pinia stores (state management)
│   └── map.store.ts
├── utils/              # Pure utility functions
│   └── map-config.ts
├── types/              # Custom TypeScript type definitions
```

### Naming Conventions

- **Components**: PascalCase (e.g., `MapViewer.vue`, `LayerPanel.vue`)
- **Composables**: camelCase with `use` prefix (e.g., `useMapInteraction`)
- **Stores**: camelCase with `.store.ts` suffix (e.g., `map.store.ts`)
- **Types**: PascalCase for interfaces/types (e.g., `MapContext`, `LayerConfig`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `DEFAULT_MAP_CONTEXT`)

### Code Style

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Not required (Prettier handles)
- **Line Length**: ≤ 100 characters (enforced by Prettier)
- **Import Order**: Framework → Third-party → Local (enforced by ESLint)

### Immutability Patterns

All state mutations **MUST** follow immutable update patterns:

```typescript
// ✅ CORRECT - creates new objects
context.value = {
  ...context.value,
  layers: context.value.layers.map(layer =>
    layer.id === targetId ? { ...layer, visible: false } : layer
  )
}

// ❌ WRONG - mutates in place
context.value.layers[0].visible = false
```

### Error Handling

- **User-facing errors**: Display in UI with clear messaging (use NuxtUI Alert/Toast components)
- **Development errors**: Use `console.error()` with context
- **Production errors**: Plan for structured logging (future)
- **Type errors**: Prevent at compile time, not runtime

## Governance

### Amendment Process

1. **Proposal**: Constitution changes must be documented in a proposal with rationale
2. **Review**: Team review of implications across codebase and workflows
3. **Migration Plan**: Document required code/template updates
4. **Approval**: Consensus required before adoption
5. **Version Bump**: Follow semantic versioning (MAJOR.MINOR.PATCH)

### Versioning Policy

- **MAJOR**: Breaking changes to principles, removed principles, or governance restructure
- **MINOR**: New principles added, expanded guidance, or new constraints
- **PATCH**: Clarifications, typo fixes, non-semantic improvements

### Compliance Review

- **Code Reviews**: Every pull request must verify constitution compliance
- **Plan Phase**: Implementation plans must include "Constitution Check" section
- **Complexity Justification**: Violations must be explicitly documented and justified
- **Continuous Improvement**: Constitution evolves based on team learnings

### Enforcement

This constitution supersedes all other development practices. When conflicts arise:
1. Constitution principles take precedence
2. Team discusses if constitution needs amendment
3. Exception requires documented justification in code/plan
4. Repeated exceptions trigger constitution review

**Version**: 1.1.0 | **Ratified**: 2026-01-05 | **Last Amended**: 2026-01-07
