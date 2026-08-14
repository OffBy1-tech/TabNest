import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MarkdownNote, type MarkdownNoteProps } from './MarkdownNote';

// Stateful wrapper so checkbox toggles and edits are visible in the story.
function StatefulMarkdownNote(props: MarkdownNoteProps): React.JSX.Element {
  const [content, setContent] = useState(props.content);
  return (
    <div style={{ width: 320 }}>
      <MarkdownNote {...props} content={content} onChange={setContent} />
    </div>
  );
}

const meta = {
  title: 'Components/Notes/MarkdownNote',
  component: MarkdownNote,
  parameters: { layout: 'centered' },
  render: (args) => <StatefulMarkdownNote {...args} />,
} satisfies Meta<typeof MarkdownNote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RichContent: Story = {
  args: {
    content: '# Project plan\nSome **bold** and *italic* and `code`.\n\n- a plain list item\n- [ ] write the docs\n- [x] ship the feature',
    placeholder: 'Add a note…',
    onChange: () => {},
  },
};

export const Checklist: Story = {
  args: {
    content: '- [ ] milk\n- [x] eggs\n- [ ] bread',
    placeholder: 'Add a note…',
    onChange: () => {},
  },
};

export const Empty: Story = {
  args: {
    content: '',
    placeholder: 'Write something… (Markdown supported)',
    onChange: () => {},
  },
};
