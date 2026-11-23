import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card } from './Card'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  args: {
    children: 'Card content',
    style: { padding: '1rem', maxWidth: 320 },
  },
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {}

export const Interactive: Story = {
  args: { interactive: true },
}
