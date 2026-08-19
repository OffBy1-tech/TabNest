import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Note } from '../../lib/schema';
import { NoteCard } from './NoteCard';
function makeNote(): Note {
  return { id: 'n1', content: 'Hello note', created_at: 0, updated_at: 0 };
}

function renderCard(overrides: Partial<Parameters<typeof NoteCard>[0]> = {}) {
  const props = {
    note: makeNote(),
    viewMode: 'grid' as const,
    onChange: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<NoteCard {...props} />);
  return props;
}

describe('NoteCard', () => {
  it('renders the note content', () => {
    renderCard();
    expect(screen.getByRole('article', { name: 'Standalone note' })).toBeInTheDocument();
    expect(screen.getByText('Hello note')).toBeInTheDocument();
  });
  it('deletes after confirmation', () => {
    const props = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(props.onDelete).toHaveBeenCalledWith('n1');
  });

  // content-visibility implies contain:paint, which traps and clips the
  // fixed-position confirm dialog — containment must lift while it is open.
  it('drops content-visibility containment while the delete confirmation is open', () => {
    renderCard();
    const card = screen.getByRole('article', { name: 'Standalone note' });
    expect(card.style.contentVisibility).toBe('auto');
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(card.style.contentVisibility).toBe('');
  });
});
