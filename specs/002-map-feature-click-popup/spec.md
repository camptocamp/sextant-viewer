# Feature Specification: Map Feature Click Popup

**Feature Branch**: `002-map-feature-click-popup`
**Created**: 2026-01-26
**Status**: Draft
**Input**: Popup on map feature click showing layer name, feature ID, and attributes

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Feature Details on Click (Priority: P1)

A user exploring the map clicks on a vector feature to inspect its properties. The feature becomes selected (highlighted), and a popup appears above it displaying the layer name, feature identifier, and all attributes.

**Why this priority**: This is the core functionality that enables users to access feature information interactively, which is the primary purpose of this feature.

**Independent Test**: Can be fully tested by loading a map with vector layers, clicking on any feature, and verifying the popup displays correct information.

**Acceptance Scenarios**:

1. **Given** a map with vector layers is displayed, **When** the user clicks on a feature, **Then** the feature becomes selected and a popup appears above it
2. **Given** a popup is displayed, **When** the user reads its content, **Then** they see the layer name as header, feature ID (or "Objet sans identifiant"), and all attributes listed
3. **Given** a feature is selected, **When** the user clicks outside any feature, **Then** the selected feature is deselected and the popup closes
4. **Given** a popup is displayed, **When** the user clicks the close button (X), **Then** the popup closes and the feature is deselected

---

### User Story 2 - Visual Feedback on Hover (Priority: P2)

A user moving the mouse over the map receives visual feedback when hovering over clickable features. The cursor changes to a pointer (hand icon) and the hovered feature appears highlighted.

**Why this priority**: This improves discoverability and user experience by indicating which elements are interactive, but is not strictly required for the core feature to function.

**Independent Test**: Can be tested by moving the mouse over features and verifying cursor change and highlight effect.

**Acceptance Scenarios**:

1. **Given** a map with vector features, **When** the user hovers over a selectable feature, **Then** the cursor changes to "pointer" (hand icon)
2. **Given** a map with vector features, **When** the user hovers over a selectable feature, **Then** the feature appears highlighted
3. **Given** the cursor is over a feature, **When** the user moves the cursor outside the feature, **Then** the cursor returns to default and the highlight disappears

---

### User Story 3 - Navigate to URLs in Attributes (Priority: P3)

A user viewing feature attributes that contain URLs can click on them to open the linked resource in a new browser tab.

**Why this priority**: This is an enhancement that adds convenience for users accessing related resources, but the feature is fully functional without it.

**Independent Test**: Can be tested by clicking on a feature with URL attributes and verifying the URLs are rendered as clickable links.

**Acceptance Scenarios**:

1. **Given** a popup displays an attribute containing an HTTP/HTTPS URL, **When** the user views the attribute, **Then** the URL is rendered as a clickable link
2. **Given** a clickable URL in the popup, **When** the user clicks on it, **Then** a new browser tab opens with the URL
3. **Given** an attribute containing a non-HTTP URL (file://, ftp://), **When** the popup displays it, **Then** the URL is shown as plain text, not clickable

---

### Edge Cases

- What happens when a feature has no attributes? The popup displays only the header (layer name) and feature identifier.
- What happens when the popup would appear outside the visible map area? The map autopans to ensure the popup is fully visible.
- What happens when a feature has no identifier (id property)? The popup displays "Objet sans identifiant" instead.
- What happens when multiple features overlap at the click location? The topmost feature is selected.
- What happens when clicking on a raster layer feature? Nothing happens (feature only applies to vector layers).
- What happens when an attribute value is null or undefined? The attribute is displayed with an empty value or a placeholder like "-".

## Requirements *(mandatory)*

### Functional Requirements

#### Selection Behavior
- **FR-001**: System MUST select a vector feature when the user clicks on it
- **FR-002**: System MUST display a popup above the selected feature
- **FR-003**: System MUST deselect the current feature and restore its original visual style when the user clicks outside any feature
- **FR-004**: System MUST deselect the feature, restore its original visual style, and close the popup when the user clicks the close button

#### Popup Content
- **FR-005**: Popup MUST display the layer name as a header
- **FR-006**: Popup MUST display "Objet #<id>" if the feature has an identifier, otherwise "Objet sans identifiant"
- **FR-007**: Popup MUST display all feature attributes in the format "<attribute name>: <value>" with attribute name in bold
- **FR-008**: Popup MUST include a close button (X) in the top-right corner

#### Visual Feedback
- **FR-009**: System MUST change cursor to "pointer" when hovering over a selectable feature
- **FR-010**: System MUST highlight the feature when the user hovers over it
- **FR-011**: System MUST apply a distinct highlight style to the selected feature

#### Map Behavior
- **FR-012**: System MUST autopan the map to ensure the popup is fully visible when opened

#### URL Handling
- **FR-013**: System MUST detect HTTP/HTTPS URLs in attribute values using pattern matching
- **FR-014**: System MUST render detected URLs as clickable links that open in a new browser tab
- **FR-015**: System MUST NOT make non-HTTP URLs clickable (file://, ftp://, etc.)

#### Scope Constraints
- **FR-016**: Feature MUST only apply to vector layers (WFS, GeoJSON, OGC API Features, etc.)
- **FR-017**: Feature MUST NOT apply to raster layers or layers without client-side feature data

### Key Entities

- **Selected Feature**: The currently selected map feature, including its geometry, properties, and parent layer reference
- **Popup State**: The visibility state, position, and content of the popup displayed above a selected feature
- **Hover State**: The currently hovered feature (if any) for visual feedback purposes

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view feature details within 1 second of clicking on a feature
- **SC-002**: Users can identify clickable features through cursor change before clicking
- **SC-003**: Popup content is fully readable without scrolling for features with up to 10 attributes
- **SC-004**: Map autopan completes within 500ms of popup opening
- **SC-005**: 100% of HTTP/HTTPS URLs in attributes are rendered as clickable links
- **SC-006**: Users can close the popup via close button or by clicking elsewhere on the map

## Assumptions

- The application uses OpenLayers for map rendering
- Vector layer features have accessible properties/attributes
- Feature identifiers are accessed via standard OpenLayers feature ID mechanisms
- The application already has mechanisms to determine layer names from features

## Implementation Notes

- Use NuxtUI UPopover with an invisible trigger element positioned at pixel coordinates (provides consistent styling with the design system)
- URL detection regex: `/\bhttps?:\/\/(?:\([^\s()]+\)|[^\s()]+)+/g`
- Layer name resolution order: `title` → `name` → `label` → `id` (geospatial-sdk layers use `label`)
