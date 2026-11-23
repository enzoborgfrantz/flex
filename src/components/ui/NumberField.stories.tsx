import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { NumberField } from './NumberField'

const meta: Meta<typeof NumberField> = {
  title: 'UI/NumberField',
  component: NumberField,
  tags: ['autodocs'],
  args: {
    value: 10,
    min: 0,
  },
}

export default meta
type Story = StoryObj<typeof NumberField>

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return <NumberField {...args} value={value} onChange={setValue} />
  },
}
