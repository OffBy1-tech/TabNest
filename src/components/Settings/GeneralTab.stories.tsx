import type { Meta, StoryObj } from '@storybook/react-vite';
import type { UserSettings } from '../../lib/schema';
import { ThemeProvider } from '../ThemeProvider';
import { GeneralTab } from './GeneralTab';

const settings: UserSettings = {
  theme: 'light',
  default_view: 'grid',
  open_tab_behavior: 'new_tab',
  save_and_close: false,
  show_favicons: true,
  compact_mode: false,
  active_tabs_on_load: true,
  default_workspace_id: null,
  show_clock: true,
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
