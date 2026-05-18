import { useState } from 'react'
import type { FormEvent } from 'react'
import { useGit } from '@core/contexts/GitContext'
import { Alert } from 'thefactory-ui/web'
import { Button } from 'thefactory-ui/web'
import { Field } from 'thefactory-ui/web'
import { Input } from 'thefactory-ui/web'
import { Modal } from 'thefactory-ui/web'

const DIRTY_TREE_MESSAGE =
  'Working tree is not clean. Commit or stash your changes before switching branches.'

export function CheckoutDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { checkout, status } = useGit()
  const [branch, setBranch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0) > 0

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = branch.trim()
    if (trimmed.length === 0 || submitting) return
    if (isDirty) {
      setError(DIRTY_TREE_MESSAGE)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await checkout(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check out')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Check out branch">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        {!error && isDirty && <Alert>{DIRTY_TREE_MESSAGE}</Alert>}
        <Field label="Branch">
          <Input
            autoFocus
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="e.g. main"
          />
        </Field>
        <div className="flex justify-end">
          <Button
            type="submit"
            loading={submitting}
            disabled={branch.trim().length === 0 || isDirty}
          >
            Check out
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function CreateBranchDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { createBranch, checkout, status } = useGit()
  const [name, setName] = useState('')
  const [from, setFrom] = useState('')
  const [checkoutAfter, setCheckoutAfter] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const isDirty = (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0) > 0
  const wouldCheckoutDirty = isDirty && checkoutAfter

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (trimmedName.length === 0 || submitting) return
    if (wouldCheckoutDirty) {
      setError(DIRTY_TREE_MESSAGE)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createBranch({ name: trimmedName, from: from.trim() || undefined })
      if (checkoutAfter) await checkout(trimmedName)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create branch">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        {!error && wouldCheckoutDirty && <Alert>{DIRTY_TREE_MESSAGE}</Alert>}
        <Field label="Branch name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="From (optional)" hint="Base branch or commit; defaults to HEAD.">
          <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="HEAD" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={checkoutAfter}
            onChange={(e) => setCheckoutAfter(e.target.checked)}
          />
          Check out after creating
        </label>
        <div className="flex justify-end">
          <Button
            type="submit"
            loading={submitting}
            disabled={trimmedName.length === 0 || wouldCheckoutDirty}
          >
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}
