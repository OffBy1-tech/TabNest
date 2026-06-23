import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, type ReactElement } from 'react';
import { KebabMenu, type KebabMenuProps } from './KebabMenu';

// The menu is absolutely positioned relative to an anchor button; this wrapper
// supplies a real anchor ref (overriding the placeholder one passed in args).
// Defined as a component so the useRef hook is valid.
function KebabMenuWithAnchor(props: KebabMenuProps): ReactElement {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <div style={{ position: 'relative', width: 200, height: 200 }}>
      <button ref={anchorRef} type="button">
        Anchor
      </button>
      <KebabMenu {...props} anchorRef={anchorRef} />
    </div>
  );
}

const meta = {
  title: 'Components/GroupCard/KebabMenu',
  component: KebabMenu,
  parameters: { layout: 'centered' },
  args: {
    onRename: () => console.log('rename'),
    onDelete: () => console.log('delete'),
    onOpenAll: () => console.log('open all'),
    onClose: () => console.log('close'),
    // Placeholder — KebabMenuWithAnchor supplies the real anchor ref.
    anchorRef: { current: null },
  },
  render: (args) => <KebabMenuWithAnchor {...args} />,
} satisfies Meta<typeof KebabMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
