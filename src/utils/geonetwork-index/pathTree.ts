import type { FieldValue } from './attributeIndex.types'

const PATH_SEPARATOR = '/'

export interface PathTreeNode {
  /** Full `/`-joined path; also the value stored in the selection. */
  path: string
  /** Last level of the path. */
  label: string
  /** Absent for an ancestor the index did not return (e.g. above a search match). */
  count?: number
  /** `undefined` while the node's children are not known; `[]` for a known leaf. */
  children?: PathTreeNode[]
}

export const parentPath = (path: string): string | undefined => {
  const index = path.lastIndexOf(PATH_SEPARATOR)
  return index === -1 ? undefined : path.slice(0, index)
}

/** `path`'s ancestors, root first (`A/B/C` → `A`, `A/B`). */
export function ancestorPaths(path: string): string[] {
  const levels = path.split(PATH_SEPARATOR)
  return levels.slice(1).map((_, i) => levels.slice(0, i + 1).join(PATH_SEPARATOR))
}

/** Whether `path` is `ancestor` itself or one of its descendants. */
export function isWithin(path: string, ancestor: string): boolean {
  return path === ancestor || path.startsWith(`${ancestor}${PATH_SEPARATOR}`)
}

/**
 * Build the tree of `/`-joined paths, siblings sorted by label. A node's children are known when
 * `childrenKnown(path)` says so (its own level and the next one were fetched); otherwise they stay
 * `undefined`. Ancestors missing from `values` are created without a count.
 */
export function buildPathTree(
  values: readonly FieldValue[],
  childrenKnown: (path: string) => boolean,
): PathTreeNode[] {
  const nodes = new Map<string, PathTreeNode>()
  const node = (path: string): PathTreeNode => {
    let existing = nodes.get(path)
    if (!existing) {
      existing = { path, label: path.slice(path.lastIndexOf(PATH_SEPARATOR) + 1) }
      if (childrenKnown(path)) existing.children = []
      nodes.set(path, existing)
    }
    return existing
  }

  for (const { value, count } of values) {
    node(value).count = count
    for (const ancestor of ancestorPaths(value)) node(ancestor)
  }

  const roots: PathTreeNode[] = []
  for (const current of nodes.values()) {
    const parent = parentPath(current.path)
    if (parent === undefined) roots.push(current)
    else nodes.get(parent)!.children?.push(current)
  }

  const sort = (list: PathTreeNode[]) => {
    list.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
    list.forEach((child) => child.children && sort(child.children))
  }
  sort(roots)
  return roots
}
