type PatchParent = HTMLElement | DocumentFragment

const elementKey = (node: Node | undefined): string | null => {
  if (!(node instanceof Element)) return null
  for (const attribute of ['id', 'data-testid', 'data-tab']) {
    const value = node.getAttribute(attribute)
    if (value) return `${node.tagName}:${attribute}:${value}`
  }
  if (!node.hasAttribute('data-action')) return null
  const data = [...node.attributes]
    .filter(({ name }) => name.startsWith('data-'))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ name, value }) => `${name}=${value}`)
    .join('|')
  return `${node.tagName}:${data}`
}

const compatible = (current: Node, next: Node): boolean => {
  if (current.nodeType !== next.nodeType) return false
  if (!(current instanceof Element) || !(next instanceof Element)) return true
  if (current.tagName !== next.tagName) return false
  const currentKey = elementKey(current)
  const nextKey = elementKey(next)
  return currentKey === nextKey || (currentKey === null && nextKey === null)
}

const syncAttributes = (current: Element, next: Element): void => {
  for (const { name } of [...current.attributes]) {
    if (!next.hasAttribute(name)) current.removeAttribute(name)
  }
  for (const { name, value } of [...next.attributes]) {
    if (current.getAttribute(name) !== value) current.setAttribute(name, value)
  }
}

const syncControlState = (current: Element, next: Element): void => {
  if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
    if (document.activeElement !== current) current.value = next.value
    current.checked = next.checked
  } else if (current instanceof HTMLSelectElement && next instanceof HTMLSelectElement) {
    if (document.activeElement !== current) current.value = next.value
  } else if (current instanceof HTMLOptionElement && next instanceof HTMLOptionElement) {
    current.selected = next.selected
  }
}

const patchNode = (current: Node, next: Node): Node => {
  if (!compatible(current, next)) {
    const replacement = next.cloneNode(true)
    current.parentNode?.replaceChild(replacement, current)
    return replacement
  }
  if (!(current instanceof Element) || !(next instanceof Element)) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue
    return current
  }
  syncAttributes(current, next)
  syncChildren(current as HTMLElement, next)
  syncControlState(current, next)
  return current
}

function syncChildren(currentParent: PatchParent, nextParent: Element | DocumentFragment): void {
  const nextChildren = [...nextParent.childNodes]
  const nextKeys = new Set(nextChildren.flatMap((node) => {
    const key = elementKey(node)
    return key ? [key] : []
  }))

  for (const node of [...currentParent.childNodes]) {
    const key = elementKey(node)
    if (key && !nextKeys.has(key)) currentParent.removeChild(node)
  }

  const existing = [...currentParent.childNodes]
  const used = new Set<Node>()
  const keyed = new Map(existing.flatMap((node) => {
    const key = elementKey(node)
    return key ? [[key, node] as const] : []
  }))

  ;nextChildren.forEach((nextChild, index) => {
    const key = elementKey(nextChild)
    const atIndex = currentParent.childNodes[index]
    let candidate: Node | undefined = key ? keyed.get(key) : undefined
    if (!candidate && atIndex && !used.has(atIndex) && compatible(atIndex, nextChild)) candidate = atIndex
    if (!candidate && !key) {
      candidate = existing.find((node) =>
        !used.has(node) && elementKey(node) === null && compatible(node, nextChild),
      )
    }

    if (!candidate) candidate = nextChild.cloneNode(true)
    const reference = currentParent.childNodes[index] ?? null
    if (candidate !== reference) currentParent.insertBefore(candidate, reference)
    used.add(candidate)
    patchNode(candidate, nextChild)
  })

  for (const node of existing) {
    if (!used.has(node) && node.parentNode === currentParent) currentParent.removeChild(node)
  }
}

export const createDomPatcher = (root: HTMLElement): ((html: string) => void) => {
  let previousHtml: string | null = null
  return (html) => {
    if (html === previousHtml) return
    const template = document.createElement('template')
    template.innerHTML = html.trim()
    syncChildren(root, template.content)
    previousHtml = html
  }
}
