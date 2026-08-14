import type { Meta, StoryObj } from '@storybook/react-vite';
import { FaviconImage } from './FaviconImage';

const meta = {
  title: 'Components/GroupCard/FaviconImage',
  component: FaviconImage,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof FaviconImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithValidUrl: Story = {
  args: {
    url: 'https://www.google.com/favicon.ico',
    title: 'Google',
    size: 16,
  },
};

export const GitHub: Story = {
  args: {
    url: 'https://github.com/favicon.ico',
    title: 'GitHub',
    size: 16,
  },
};

export const LargeSize: Story = {
  args: {
    url: 'https://www.wikipedia.org/favicon.ico',
    title: 'Wikipedia',
    size: 32,
  },
};

export const BrokenUrl: Story = {
  args: {
    url: 'https://this-domain-does-not-exist.invalid/favicon.ico',
    title: 'Broken Site',
    size: 16,
  },
};

export const EmptyUrl: Story = {
  args: {
    url: '',
    title: 'No Favicon',
    size: 16,
  },
};

export const SingleCharacterFallback: Story = {
  args: {
    url: '',
    title: 'Anthropic Research Notes',
    size: 24,
  },
};
