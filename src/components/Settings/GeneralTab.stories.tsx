import type { Meta, StoryObj } from '@storybook/react-vite';
import { DEFAULT_SETTINGS, type UserSettings } from '../../lib/schema';
import { ThemeProvider } from '../ThemeProvider';
import { GeneralTab } from './GeneralTab';

const settings: UserSettings = {
  ...DEFAULT_SETTINGS,
  theme: 'light',
  active_tabs_on_load: true,
};

const meta = {
  title: 'Components/Settings/GeneralTab',
  component: GeneralTab,
  parameters: { layout: 'padded' },
  args: { settings, onChange: (patch) => console.log('change', patch) },
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="light">
        <div style={{ maxWidth: 560 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof GeneralTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
