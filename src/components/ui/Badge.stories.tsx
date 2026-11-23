import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    tone: { control: 'select', options: ['accent', 'neutral'] },
  },
  args: {
    children: 'Badge',
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Accent: Story = {
  args: { tone: 'accent' },
}

export const Neutral: Story = {
  args: { tone: 'neutral' },
}
