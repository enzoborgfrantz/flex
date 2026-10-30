import type { CSSProperties, HTMLAttributes } from 'react'

export interface ElasticMeshProps extends HTMLAttributes<HTMLDivElement> {
  text?: string
  src?: string
  fontFamily?: string
  fontWeight?: number
  color?: string
  imageColors?: boolean
  material?: 'balloon' | 'chrome' | 'jelly' | 'clay'
  inflate?: number
  stiffness?: number
  wobble?: number
  grabRadius?: number
  stretch?: number
  press?: number
  shadow?: number
  intro?: boolean
  theme?: 'dark' | 'light'
  dpr?: number
  className?: string
  style?: CSSProperties
}

declare function ElasticMesh(props: ElasticMeshProps): JSX.Element

export default ElasticMesh
