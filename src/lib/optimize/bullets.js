import { sanitize, isBlankHtml } from '../format'

// A description's "items" are its list items and top-level paragraphs, in document order.
// Both the optimiser and the API address bullets by this index.

function parse(html) {
  const doc = new DOMParser().parseFromString(`<div>${sanitize(html || '')}</div>`, 'text/html')
  const root = doc.body.firstChild
  const items = []
  for (const node of root.childNodes) {
    if (node.nodeType !== 1) continue
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      for (const li of node.children) if (li.tagName === 'LI' && !isBlankHtml(li.innerHTML)) items.push(li)
    } else if (!isBlankHtml(node.innerHTML)) items.push(node)
  }
  return { root, items }
}

const text = el => el.textContent.replace(/\s+/g, ' ').trim()

export const getItems = html => parse(html).items.map((el, i) => ({ i, text: text(el), isBullet: el.tagName === 'LI' }))

const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// Replace item i's text (plain text; formatting inside that item is dropped).
export function setItem(html, i, newText) {
  const { root, items } = parse(html)
  if (!items[i]) return html
  items[i].innerHTML = esc(newText.trim())
  return root.innerHTML
}

// Move item i to the top of its list.
export function moveItemUp(html, i) {
  const { root, items } = parse(html)
  const el = items[i]
  if (!el || !el.parentNode) return html
  el.parentNode.insertBefore(el, el.parentNode.firstElementChild)
  return root.innerHTML
}

// Apply a small text transform to every item (used by auto-fixes).
export function mapItems(html, fn) {
  const { root, items } = parse(html)
  for (const el of items) {
    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const nodes = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n)
    if (nodes.length) nodes[0].nodeValue = fn(nodes[0].nodeValue, 'first')
    for (const n of nodes) n.nodeValue = fn(n.nodeValue, 'all')
  }
  return root.innerHTML
}
