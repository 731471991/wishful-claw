/**
 * JavaScript snippets injected into the browser webview for page manipulation.
 * Each script is a self-contained IIFE that returns a JSON-serializable result.
 */

/** Converts page DOM to Markdown (headings, links, lists, tables, code blocks, images). */
export const HTML_TO_MD_SCRIPT = `
(function(sel) {
  var root = sel ? document.querySelector(sel) : document.body
  if (!root) return JSON.stringify({ error: 'Element not found: ' + sel })

  function convert(node, listDepth) {
    if (node.nodeType === 3) return node.textContent || ''
    if (node.nodeType !== 1) return ''
    var el = node
    var tag = el.tagName.toLowerCase()
    var children = ''
    for (var i = 0; i < el.childNodes.length; i++) children += convert(el.childNodes[i], listDepth)
    children = children.trim()
    if (!children && !['img','br','hr','input'].includes(tag)) return ''

    switch (tag) {
      case 'h1': return '\\n# ' + children + '\\n'
      case 'h2': return '\\n## ' + children + '\\n'
      case 'h3': return '\\n### ' + children + '\\n'
      case 'h4': return '\\n#### ' + children + '\\n'
      case 'h5': return '\\n##### ' + children + '\\n'
      case 'h6': return '\\n###### ' + children + '\\n'
      case 'p': return '\\n' + children + '\\n'
      case 'br': return '\\n'
      case 'hr': return '\\n---\\n'
      case 'strong': case 'b': return '**' + children + '**'
      case 'em': case 'i': return '*' + children + '*'
      case 'del': case 's': return '~~' + children + '~~'
      case 'code':
        if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') return children
        return '\`' + children + '\`'
      case 'pre':
        var code = el.querySelector('code')
        var lang = ''
        if (code) {
          var cls = code.className || ''
          var m = cls.match(/language-(\\w+)/)
          if (m) lang = m[1]
        }
        return '\\n\`\`\`' + lang + '\\n' + (code ? code.textContent : el.textContent) + '\\n\`\`\`\\n'
      case 'blockquote': return '\\n' + children.split('\\n').map(function(l) { return '> ' + l }).join('\\n') + '\\n'
      case 'a':
        var href = el.getAttribute('href') || ''
        if (!href || href === '#') return children
        return '[' + children + '](' + href + ')'
      case 'img':
        var src = el.getAttribute('src') || ''
        var alt = el.getAttribute('alt') || ''
        return '![' + alt + '](' + src + ')'
      case 'ul': case 'ol':
        return '\\n' + Array.from(el.children).map(function(li, idx) {
          var prefix = tag === 'ol' ? (idx + 1) + '. ' : '- '
          var indent = '  '.repeat(listDepth)
          var content = convert(li, listDepth + 1).trim()
          return indent + prefix + content
        }).join('\\n') + '\\n'
      case 'li': return children
      case 'table':
        var rows = Array.from(el.querySelectorAll('tr'))
        if (!rows.length) return children
        var result = '\\n'
        rows.forEach(function(tr, ri) {
          var cells = Array.from(tr.querySelectorAll('th, td')).map(function(c) { return convert(c, 0).trim() })
          result += '| ' + cells.join(' | ') + ' |\\n'
          if (ri === 0) result += '| ' + cells.map(function() { return '---' }).join(' | ') + ' |\\n'
        })
        return result
      case 'script': case 'style': case 'noscript': return ''
      default: return children
    }
  }

  var md = convert(root, 0).replace(/\\n{3,}/g, '\\n\\n').trim()
  return JSON.stringify({ title: document.title, content: md })
})
`

/** Collects all interactive elements (links, buttons, inputs) with unique CSS selectors. */
export const SNAPSHOT_SCRIPT = `
(function() {
  var selectors = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [onclick]'
  var els = document.querySelectorAll(selectors)
  var results = []
  var seen = new Set()

  function uniqueSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id)
    var path = []
    var cur = el
    while (cur && cur !== document.body) {
      var tag = cur.tagName.toLowerCase()
      var parent = cur.parentElement
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === cur.tagName })
        if (siblings.length > 1) {
          tag += ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')'
        }
      }
      path.unshift(tag)
      cur = parent
    }
    return path.join(' > ')
  }

  els.forEach(function(el) {
    if (el.offsetParent === null && el.tagName !== 'INPUT' && el.getAttribute('type') !== 'hidden') return
    var sel = uniqueSelector(el)
    if (seen.has(sel)) return
    seen.add(sel)
    var tag = el.tagName.toLowerCase()
    var text = (el.textContent || '').trim().substring(0, 80).replace(/\\s+/g, ' ')
    var type = el.getAttribute('type') || ''
    var name = el.getAttribute('name') || ''
    var placeholder = el.getAttribute('placeholder') || ''
    var role = el.getAttribute('role') || ''
    var href = el.getAttribute('href') || ''
    var value = ''
    if (tag === 'input' || tag === 'textarea') value = (el.value || '').substring(0, 40)
    if (tag === 'select') value = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : ''

    var desc = tag
    if (type) desc += '[type=' + type + ']'
    if (role) desc += '[role=' + role + ']'
    if (name) desc += ' name="' + name + '"'
    if (placeholder) desc += ' placeholder="' + placeholder + '"'
    if (href) desc += ' href="' + href.substring(0, 100) + '"'
    if (value) desc += ' value="' + value + '"'
    if (text) desc += ' - "' + text + '"'

    results.push({ selector: sel, description: desc })
  })

  return JSON.stringify({ title: document.title, count: results.length, elements: results })
})()
`

/** Clicks an element by CSS selector or text= prefix. */
export const CLICK_SCRIPT = `
(function(selector) {
  var el
  if (selector.startsWith('text=')) {
    var searchText = selector.slice(5)
    var all = document.querySelectorAll('a, button, [role="button"], [onclick], input[type="submit"], input[type="button"]')
    for (var i = 0; i < all.length; i++) {
      if ((all[i].textContent || '').trim().includes(searchText)) { el = all[i]; break }
    }
    if (!el) {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
      while (walker.nextNode()) {
        if ((walker.currentNode.textContent || '').trim().includes(searchText) && walker.currentNode.offsetParent !== null) {
          el = walker.currentNode; break
        }
      }
    }
  } else {
    el = document.querySelector(selector)
  }
  if (!el) return JSON.stringify({ error: 'Element not found: ' + selector })
  el.scrollIntoView({ block: 'center', behavior: 'instant' })
  el.click()
  return JSON.stringify({ success: true, tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().substring(0, 80) })
})
`

/** Types text into an input, textarea, or contenteditable element. */
export const TYPE_SCRIPT = `
(function(selector, text, clear, submit) {
  var el = document.querySelector(selector)
  if (!el) return JSON.stringify({ error: 'Element not found: ' + selector })
  var tag = el.tagName.toLowerCase()
  if (tag !== 'input' && tag !== 'textarea' && !el.isContentEditable) {
    return JSON.stringify({ error: 'Element is not an input field: ' + selector })
  }
  el.focus()
  if (el.isContentEditable) {
    if (clear) el.textContent = ''
    el.textContent += text
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } else {
    var setter = Object.getOwnPropertyDescriptor(
      tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
    ).set
    setter.call(el, (clear ? '' : el.value) + text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  if (submit) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
    el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
    if (el.form) el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit()
  }
  return JSON.stringify({ success: true, tag: tag, value: (el.value || el.textContent || '').substring(0, 200) })
})
`
