import type { Entity } from 'thefactory-db'

export type Zoom = 'day' | 'week' | 'month'

export type Unit = {
  key: string
  start: Date
  labelTop: string
  labelBottom?: string
  groupLabel: string
}

export interface TimestampContent {
  timestamp: string
  label: string
  description?: string
  featureId?: string
}

export interface TimelineLabel extends Entity {
  content: TimestampContent
}

export interface RowItem {
  id: string
  title: string
  timestamp: string
  kind: 'feature' | 'story' | 'label'
  storyId?: string
  scope?: 'project' | '__global__'
  projectId?: string
}

export type RowDefinition = {
  key: string
  title: string
  items: RowItem[]
  projectId?: string
  projectTitle?: string
}

export type HoverInfo =
  | null
  | {
      kind: 'story'
      storyId: string
      rect: DOMRect
    }
  | {
      kind: 'feature'
      storyId: string
      featureId: string
      rect: DOMRect
    }
