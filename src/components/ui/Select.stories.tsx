import type { Meta, StoryObj } from '@storybook/react-vite'
import { Select } from './Select'

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
  args: {
    label: 'Label',
    options: [
      { value: 'push', label: 'Push' },
      { value: 'pull', label: 'Pull' },
      { value: 'legs', label: 'Legs' },
    ],
  },
}

export default meta
type Story = StoryObj<typeof Select>

export const Default: Story = {}
