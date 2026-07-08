import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, FolderOpen, Tag, Globe } from 'lucide-react'
import {
  buildSearchIndex,
  createSearchEngine,
  search,
  type SearchRecord,
} from '../../lib/search'
import type { Workspace } from '../../lib/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  workspaces: Workspace[]
  onNavigate?: (record: SearchRecord) => void
}

type ResultSection = {
  type: SearchRecord['type']
  label: string
  items: SearchRecord[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTypeIcon(type: SearchRecord['type']): React.JSX.Element {
  switch (type) {
    case 'tab':
      return <Link size={14} aria-hidden="true" />
    case 'group':
      return <FolderOpen size={14} aria-hidden="true" />
    case 'category':
      return <Tag size={14} aria-hidden="true" />
    default:
      return <Globe size={14} aria-hidden="true" />
  }
}

const TYPE_ORDER: SearchRecord['type'][] = ['tab', 'group', 'category', 'workspace']
const TYPE_LABELS: Record<SearchRecord['type'], string> = {
  tab: 'Tabs',
  group: 'Groups',
  category: 'Categories',
  workspace: 'Workspaces',
}

function groupResults(records: SearchRecord[]): ResultSection[] {
  const grouped: Partial<Record<SearchRecord['type'], SearchRecord[]>> = {}
  for (const record of records) {
    if (!grouped[record.type]) grouped[record.type] = []
    grouped[record.type]!.push(record)
  }
  return TYPE_ORDER.filter((type) => (grouped[type]?.length ?? 0) > 0).map(
    (type) => ({
      type,
      label: TYPE_LABELS[type],
      items: grouped[type]!,
    }),
  )
}

// Flat list of all result items in display order (for keyboard navigation)
function flattenSections(sections: ResultSection[]): SearchRecord[] {
  return sections.flatMap((s) => s.items)
}

// ---------------------------------------------------------------------------
// SearchOverlay
// ---------------------------------------------------------------------------

export function SearchOverlay({
  isOpen,
  onClose,
  workspaces,
  onNavigate,
}: SearchOverlayProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Stable ref so the document listener never needs to be re-registered when onClose changes
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Build search index + engine whenever workspaces change
  const engine = useMemo(() => {
    const index = buildSearchIndex(workspaces)
    return createSearchEngine(index)
  }, [workspaces])

  const results = useMemo<SearchRecord[]>(() => {
    if (query.trim().length === 0) return []
    return search(engine, query)
  }, [engine, query])

  const sections = useMemo(() => groupResults(results), [results])
  const flatResults = useMemo(() => flattenSections(sections), [sections])

  // Reset state and focus when overlay opens
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen])

  // Capture-phase document listener: fires before any child element handler,
  // and only re-registers when isOpen changes (not on every render).
  useEffect(() => {
    if (!isOpen) return undefined
    function handleEscape(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleEscape, { capture: true })
    return () => document.removeEventListener('keydown', handleEscape, { capture: true })
  }, [isOpen])

  // Clamp active index when results change
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, flatResults.length - 1)))
  }, [flatResults.length])

  const activateResult = useCallback(
    (record: SearchRecord): void => {
      if (record.type === 'tab' && record.url) {
        window.open(record.url, '_blank', 'noopener,noreferrer')
      } else {
        onNavigate?.(record)
      }
      onClose()
    },
    [onClose, onNavigate],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) =>
          flatResults.length > 0 ? Math.min(prev + 1, flatResults.length - 1) : 0,
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const record = flatResults[activeIndex]
        if (record) activateResult(record)
      }
    },
    [flatResults, activeIndex, onClose, activateResult],
  )

  // Focus trap: Tab key stays inside panel
  function handlePanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Tab') {
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'input, button, [tabindex="0"]',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
  }

  if (!isOpen) return null

  // Accumulate flat index for result rendering
  let flatIndex = 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        backgroundColor: 'var(--bg-overlay)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 'var(--space-12)',
        paddingBottom: 'var(--space-8)',
        paddingLeft: 'var(--space-4)',
        paddingRight: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        onKeyDown={handlePanelKeyDown}
        style={{
          width: '100%',
          maxWidth: 672, // ~max-w-2xl
          backgroundColor: 'var(--bg-base)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: 'var(--space-4)',
            borderBottom:
              results.length > 0 ? '1px solid var(--border-default)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <Globe
            size={18}
            aria-hidden="true"
            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            aria-label="Search tabs, groups, and notes"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={
              flatResults[activeIndex]
                ? `search-result-${flatResults[activeIndex].id}`
                : undefined
            }
            placeholder="Search tabs, groups, categories..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: 'var(--text-base)',
              color: 'var(--text-primary)',
            }}
          />
          {query.length > 0 && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 'var(--text-xs)' }}>✕</span>
            </button>
          )}
          <kbd
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              fontFamily: 'inherit',
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div
            id="search-results"
            role="listbox"
            aria-label="Search results"
            style={{
              overflowY: 'auto',
              maxHeight: 480,
              padding: 'var(--space-2)',
            }}
          >
            {sections.map((section) => (
              <div key={section.type}>
                {/* Section heading */}
                <div
                  role="presentation"
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {section.label}
                </div>

                {section.items.map((record) => {
                  const currentIndex = flatIndex
                  flatIndex += 1
                  const isActive = currentIndex === activeIndex

                  return (
                    <button
                      key={record.id}
                      id={`search-result-${record.id}`}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => activateResult(record)}
                      onMouseEnter={() => setActiveIndex(currentIndex)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        width: '100%',
                        padding: 'var(--space-2) var(--space-3)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isActive
                          ? 'var(--color-brand-100)'
                          : 'transparent',
                        color: isActive ? 'var(--color-brand-500)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition:
                          'background-color var(--duration-fast) var(--ease-default)',
                        outline: 'none',
                      }}
                    >
                      {/* Icon */}
                      <span
                        style={{
                          color: isActive
                            ? 'var(--color-brand-500)'
                            : 'var(--text-muted)',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {getTypeIcon(record.type)}
                      </span>

                      {/* Title + breadcrumb */}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {record.title}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {record.breadcrumb}
                        </span>
                      </span>

                      {/* URL for tabs */}
                      {record.url && (
                        <span
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 160,
                            flexShrink: 0,
                          }}
                        >
                          {(() => {
                            try {
                              return new URL(record.url).hostname
                            } catch {
                              return ''
                            }
                          })()}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {query.trim().length > 0 && results.length === 0 && (
          <div
            style={{
              padding: 'var(--space-8)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            No results for "{query}"
          </div>
        )}

        {/* Hint when empty query */}
        {query.trim().length === 0 && (
          <div
            style={{
              padding: 'var(--space-8)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            Start typing to search your tabs, groups, and categories.
          </div>
        )}
      </div>
    </div>
  )
}
