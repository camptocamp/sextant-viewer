# Feature Specification: Layer Manager

**Feature Branch**: `003-layer-manager`
**Created**: 2026-01-07
**Status**: Draft
**Input**: User description: "I want to create a layer manager, the layer should list all the layers (but the background layer, basemap). The list should be ordered according to the layer position in the map context, the highest in the list is the last in the array (most visible). The list should display the layer label (truncate). On the right, a dot icon should open a contextual menu (with NuxUI), in this menu, we should have the 'delete layer' option."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Layer List (Priority: P1)

Users need to see all active map layers (excluding the basemap) in a clear, organized list that reflects the visual stacking order on the map. This helps users understand which data layers are currently displayed and their relative visibility order.

**Why this priority**: This is the core functionality - without being able to view the layer list, users cannot manage layers. This is the foundation upon which all other layer management features are built.

**Independent Test**: Can be fully tested by loading a map with multiple layers and verifying that the layer manager displays all non-basemap layers in the correct visual order (top of list = most visible on map).

**Acceptance Scenarios**:

1. **Given** a map with 3 data layers and 1 basemap layer, **When** the user opens the layer manager, **Then** the layer manager displays exactly 3 layers (excluding the basemap)
2. **Given** a map with layers A (bottom), B (middle), C (top), **When** the user views the layer manager, **Then** the list displays layers in order: C (top of list), B (middle), A (bottom of list)
3. **Given** a layer with a long name "Very Long Layer Name That Exceeds Display Width", **When** displayed in the layer manager, **Then** the label is truncated with an ellipsis (e.g., "Very Long Layer Name T...")
4. **Given** a map with no data layers (only basemap), **When** the user opens the layer manager, **Then** the layer manager displays an empty state message
5. **Given** the layer order changes in the map context, **When** the layer manager updates, **Then** the list reflects the new order immediately

---

### User Story 2 - Delete Layer via Context Menu (Priority: P2)

Users need to remove unwanted layers from the map to reduce clutter and focus on relevant data. This is done through a contextual menu accessed via a menu icon next to each layer.

**Why this priority**: Layer deletion is a critical management function but depends on the layer list being visible first (P1). This enables users to actively curate their map view.

**Independent Test**: Can be tested independently by opening the layer manager with existing layers, clicking the menu icon on any layer, selecting "Delete layer", and verifying the layer is removed from both the list and the map.

**Acceptance Scenarios**:

1. **Given** a layer in the layer manager, **When** the user clicks the dot icon (menu button) next to the layer, **Then** a context menu appears with a "Delete layer" option
2. **Given** the context menu is open for a layer, **When** the user clicks "Delete layer", **Then** the layer is removed from the map context
3. **Given** a layer is deleted, **When** the deletion completes, **Then** the layer manager list updates to no longer show the deleted layer
4. **Given** the context menu is open, **When** the user clicks outside the menu, **Then** the context menu closes without deleting the layer
5. **Given** only one layer remains in the layer manager, **When** the user deletes it, **Then** the layer manager shows an empty state
6. **Given** a layer is deleted, **When** the user looks at the map, **Then** the visual layer is no longer visible on the map

---

### Edge Cases

- What happens when all layers are deleted (only basemap remains)?
- How does the system handle a layer being deleted while its context menu is still open?
- What happens if the layer order changes while the context menu is open?
- How does the system handle very long layer names (100+ characters)?
- What happens when layers are added dynamically while the layer manager is visible?
- How does truncation work with special characters or emojis in layer names?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display all layers from the map context except layers marked as basemap/background layers
- **FR-002**: System MUST order the layer list in reverse array order (last item in array = top of displayed list)
- **FR-003**: System MUST display each layer's label in the list
- **FR-004**: System MUST truncate layer labels that exceed available display width with an ellipsis
- **FR-005**: System MUST display a menu icon (dot icon) on the right side of each layer item
- **FR-006**: System MUST open a context menu when the user clicks/activates the menu icon
- **FR-007**: Context menu MUST include a "Delete layer" option
- **FR-008**: System MUST use NuxtUI components for the context menu (UContextMenu or UDropdownMenu)
- **FR-009**: System MUST remove the layer from the map context when "Delete layer" is selected
- **FR-010**: System MUST update the layer list immediately when layers are added, removed, or reordered
- **FR-011**: System MUST display an empty state when no data layers exist (only basemap)
- **FR-012**: System MUST close the context menu when the user clicks outside it or after selecting an action
- **FR-013**: Layer list MUST reflect the current state of the MapContext (via Pinia store)
- **FR-014**: System MUST handle layer deletion through immutable MapContext updates

### Key Entities

- **Layer**: Represents a map layer with properties including unique identifier, label/name, position in stack order, and layer type (data layer vs basemap)
- **MapContext**: Contains the ordered collection of all map layers, where array position determines visual stacking order
- **Layer Manager Component**: UI component that displays the filtered and ordered list of layers with management controls

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view all data layers in the correct stacking order within 1 second of opening the layer manager
- **SC-002**: Users can successfully delete any layer within 3 clicks (open menu → click delete → confirm/complete)
- **SC-003**: Layer list updates reflect map state changes within 100ms
- **SC-004**: Truncated layer names remain readable with at least 20 characters visible before truncation
- **SC-005**: 100% of layer deletions result in the layer being removed from both the list and the map view
- **SC-006**: Context menu operates smoothly with no UI lag when opening/closing (< 100ms response time)

## Assumptions

- Basemap/background layers are identifiable through a property or layer type in the MapContext
- Layer labels are available as a property on each layer object
- The MapContext maintains layers in an array where the last element is the topmost (most visible) layer
- Layer deletion is a synchronous operation that updates the MapContext
- NuxtUI v4 components (UDropdownMenu or UContextMenu) are already available in the project
- The layer manager will be a standalone component that can be placed in the application layout
- Users understand that deleting a layer removes it from the current map view (no undo functionality required in MVP)
