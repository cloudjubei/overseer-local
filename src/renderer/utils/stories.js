'use strict'

// Utilities for working with stories and features in the renderer

export function toStoriesArray(index) {
  const storiesById = (index && index.storiesById) || {}
  const arr = Object.values(storiesById)
  // Sort by id numeric asc
  arr.sort((a, b) => (a.id || 0) - (b.id || 0))
  return arr
}

export function countFeatures(story) {
  const features = Array.isArray(story.features) ? story.features : []
  const total = features.length
  const done = features.filter((f) => f.status === '+').length
  return { done, total }
}

export function matchesQuery(story, q) {
  if (!q) return true
  const s = q.trim().toLowerCase()
  if (!s) return true
  const idStr = String(story.id || '')
  return (
    idStr.includes(s) ||
    (story.title && story.title.toLowerCase().includes(s)) ||
    (story.description && story.description.toLowerCase().includes(s))
  )
}

export function filterStories(stories, { query, status }) {
  return stories.filter((t) => {
    const byStatus = !status || status === 'any' ? true : t.status === status
    return byStatus && matchesQuery(t, query || '')
  })
}

export function computeNextStoryId(index) {
  const stories = toStoriesArray(index || {})
  let max = 0
  for (const t of stories) {
    const id = parseInt((t && t.id) || 0, 10)
    if (Number.isInteger(id) && id > max) max = id
  }
  return max + 1 || 1
}
