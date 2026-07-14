import { describe, it, expect } from 'vitest'
import {
  parseMarkdown,
  parseInline,
  toggleCheckbox,
  hasCheckedItems,
  clearCheckedItems,
} from './markdown'

describe('parseInline', () => {
  it('passes plain text through', () => {
    expect(parseInline('hello world')).toEqual([{ kind: 'text', text: 'hello world' }])
  })

  it('parses bold, italic, and inline code', () => {
    expect(parseInline('a **b** *c* `d`')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'italic', text: 'c' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'd' },
    ])
  })

  it('supports underscore variants', () => {
    expect(parseInline('__b__ _i_')).toEqual([
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'italic', text: 'i' },
    ])
  })

  it('treats code content literally (no nested formatting)', () => {
    expect(parseInline('`**not bold**`')).toEqual([{ kind: 'code', text: '**not bold**' }])
  })
})

describe('parseMarkdown', () => {
  it('parses headings levels 1-3', () => {
    const blocks = parseMarkdown('# One\n## Two\n### Three')
    expect(blocks.map((b) => (b.kind === 'heading' ? b.level : null))).toEqual([1, 2, 3])
  })

  it('does not treat #### as a heading', () => {
    expect(parseMarkdown('#### Four')[0]!.kind).toBe('paragraph')
  })

  it('parses list items and checkboxes with running checkbox indices', () => {
    const blocks = parseMarkdown('- plain\n- [ ] todo\n- [x] done\n- [X] DONE')
    expect(blocks[0]!.kind).toBe('list-item')
    expect(blocks[1]).toMatchObject({ kind: 'checkbox', checked: false, checkboxIndex: 0 })
    expect(blocks[2]).toMatchObject({ kind: 'checkbox', checked: true, checkboxIndex: 1 })
    expect(blocks[3]).toMatchObject({ kind: 'checkbox', checked: true, checkboxIndex: 2 })
  })

  it('parses blank lines and paragraphs', () => {
    const blocks = parseMarkdown('para one\n\npara two')
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'blank', 'paragraph'])
  })
})

describe('toggleCheckbox', () => {
  const source = '# Title\n- [ ] first\ntext\n- [x] second'

  it('checks an unchecked box by index', () => {
    expect(toggleCheckbox(source, 0)).toContain('- [x] first')
  })

  it('unchecks a checked box by index', () => {
    expect(toggleCheckbox(source, 1)).toContain('- [ ] second')
  })

  it('leaves other lines untouched', () => {
    const result = toggleCheckbox(source, 0)
    expect(result).toContain('# Title')
    expect(result).toContain('- [x] second')
  })

  it('preserves leading indentation', () => {
    expect(toggleCheckbox('  - [ ] nested', 0)).toBe('  - [x] nested')
  })
})

describe('hasCheckedItems / clearCheckedItems', () => {
  it('detects checked items', () => {
    expect(hasCheckedItems('- [x] done')).toBe(true)
    expect(hasCheckedItems('- [ ] todo')).toBe(false)
    expect(hasCheckedItems('plain text')).toBe(false)
  })

  it('removes only checked lines', () => {
    const source = '# Keep\n- [ ] keep todo\n- [x] remove\n- [X] remove too\nkeep text'
    expect(clearCheckedItems(source)).toBe('# Keep\n- [ ] keep todo\nkeep text')
  })
})
