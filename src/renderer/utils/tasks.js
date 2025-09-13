'use strict'

// Utilities for working with tasks and features in the renderer

export function toTasksArray(index) {
  const tasksById = (index && index.tasksById) || {}
  const arr = Object.values(tasksById)
  // Sort by id numeric asc
  arr.sort((a, b) => (a.id || 0) - (b.id || 0))
  return arr
}

export function countFeatures(task) {
  const features = Array.isArray(task.features) ? task.features : []
  const total = features.length
  const done = features.filter((f) => f.status === '+').length
  return { done, total }
}

export function matchesQuery(task, q) {
  if (!q) return true
  const s = q.trim().toLowerCase()
  if (!s) return true
  const idStr = String(task.id || '')
  return (
    idStr.includes(s) ||
    (task.title && task.title.toLowerCase().includes(s)) ||
    (task.description && task.description.toLowerCase().includes(s))
  )
}

export function filterTasks(tasks, { query, status }) {
  return tasks.filter((t) => {
    const byStatus = !status || status === 'any' ? true : t.status === status
    return byStatus && matchesQuery(t, query || '')
  })
}

export function computeNextTaskId(index) {
  const tasks = toTasksArray(index || {})
  let max = 0
  for (const t of tasks) {
    const id = parseInt((t && t.id) || 0, 10)
    if (Number.isInteger(id) && id > max) max = id
  }
  return max + 1 || 1
}
