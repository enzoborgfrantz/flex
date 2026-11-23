import type { Meta, StoryObj } from '@storybook/react-vite'
import { TextField } from './TextField'

const meta: Meta<typeof TextField> = {
  title: 'UI/TextField',
  component: TextField,
  tags: ['autodocs'],
  args: {
    label: 'Label',
    placeholder: 'Type something…',
  },
}

export default meta
type Story = StoryObj<typeof TextField>

export const Default: Story = {}

export const NoLabel: Story = {
  args: { label: undefined },
}

export const Disabled: Story = {
  args: { disabled: true },
}
