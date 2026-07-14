/**
 * markdown.ts
 * Tiny dependency-free parser for the note Markdown subset (spec §7.2):
 * headers (#/##/###), bold, italic, inline code, unordered lists, and
 * checkboxes. Line-based: each input line becomes one block.
 *
 * The checkbox helpers (`toggleCheckbox`, `clearCheckedItems`) operate on the
 * raw note text so the stored source stays plain Markdown.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; inline: InlineToken[] }
  | { kind: 'list-item'; inline: InlineToken[] }
  | { kind: 'checkbox'; checked: boolean; checkboxIndex: number; inline: InlineToken[] }
  | { kind: 'paragraph'; inline: InlineToken[] }
  | { kind: 'blank' }

const CHECKBOX_RE = /^(\s*)[-*] \[( |x|X)\] (.*)$/
const LIST_RE = /^(\s*)[-*] (.*)$/
const HEADING_RE = /^(#{1,3}) (.*)$/

// ---------------------------------------------------------------------------
// Inline tokenizer — bold (**x** / __x__), italic (*x* / _x_), code (`x`)
// ---------------------------------------------------------------------------

const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)/g

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let last = 0
  for (const match of text.matchAll(INLINE_RE)) {
    const idx = match.index
    if (idx > last) tokens.push({ kind: 'text', text: text.slice(last, idx) })
    const raw = match[0]
    if (raw.startsWith('`')) {
      tokens.push({ kind: 'code', text: raw.slice(1, -1) })
    } else if (raw.startsWith('**') || raw.startsWith('__')) {
      tokens.push({ kind: 'bold', text: raw.slice(2, -2) })
    } else {
      tokens.push({ kind: 'italic', text: raw.slice(1, -1) })
    }
    last = idx + raw.length
  }
  if (last < text.length) tokens.push({ kind: 'text', text: text.slice(last) })
  return tokens
}

// ---------------------------------------------------------------------------
// Block parser
// ---------------------------------------------------------------------------

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  let checkboxIndex = 0

  for (const line of source.split('\n')) {
    if (line.trim() === '') {
      blocks.push({ kind: 'blank' })
      continue
    }
    const heading = HEADING_RE.exec(line)
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        inline: parseInline(heading[2]!),
      })
      continue
    }
    const checkbox = CHECKBOX_RE.exec(line)
    if (checkbox) {
      blocks.push({
        kind: 'checkbox',
        checked: checkbox[2]!.toLowerCase() === 'x',
        checkboxIndex: checkboxIndex++,
        inline: parseInline(checkbox[3]!),
      })
      continue
    }
    const list = LIST_RE.exec(line)
    if (list) {
      blocks.push({ kind: 'list-item', inline: parseInline(list[2]!) })
      continue
    }
    blocks.push({ kind: 'paragraph', inline: parseInline(line) })
  }

  return blocks
}

// ---------------------------------------------------------------------------
// Checkbox source-text helpers (spec §7.3)
// ---------------------------------------------------------------------------

/** Flip the checked state of the nth checkbox (0-based) in the source text. */
export function toggleCheckbox(source: string, checkboxIndex: number): string {
  let seen = 0
  return source
    .split('\n')
    .map((line) => {
      const match = CHECKBOX_RE.exec(line)
      if (!match) return line
      if (seen++ !== checkboxIndex) return line
      const flipped = match[2]!.toLowerCase() === 'x' ? ' ' : 'x'
      return `${match[1]}- [${flipped}] ${match[3]}`
    })
    .join('\n')
}

/** True when the source contains at least one checked checkbox. */
export function hasCheckedItems(source: string): boolean {
  return source.split('\n').some((line) => {
    const match = CHECKBOX_RE.exec(line)
    return match != null && match[2]!.toLowerCase() === 'x'
  })
}

/** Remove all checked checkbox lines (spec §7.3 "Clear checked items"). */
export function clearCheckedItems(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const match = CHECKBOX_RE.exec(line)
      return !(match != null && match[2]!.toLowerCase() === 'x')
    })
    .join('\n')
}
