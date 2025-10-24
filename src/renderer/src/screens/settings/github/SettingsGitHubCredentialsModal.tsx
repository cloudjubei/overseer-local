import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import { useGitHubCredentials } from '@renderer/contexts/GitHubCredentialsContext'
import React, { useEffect, useState } from 'react'

export default function SettingsGitHubCredentialsModal({
  mode,
  id,
  onRequestClose,
}: {
  mode: 'add' | 'edit'
  id?: string
  onRequestClose: () => void
}) {
  const { credentials, addCredentials, updateCredentials } = useGitHubCredentials()
  const isEdit = mode === 'edit'
  const existing = isEdit ? credentials.find((c) => c.id === id) || null : null

  const [form, setForm] = useState({
    id: '',
    name: '',
    username: '',
    email: '',
    token: '',
  })

  useEffect(() => {
    if (existing) {
      setForm({
        id: existing.id || '',
        name: existing.name || '',
        username: existing.username || '',
        email: existing.email || '',
        token: existing.token || '',
      })
    }
  }, [existing])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.username || !form.email || !form.token) {
      // light inline validation
      return
    }
    if (isEdit) {
      await updateCredentials(form.id, { ...form })
    } else {
      const { id: _omit, ...toAdd } = form
      await addCredentials(toAdd)
    }
    onRequestClose()
  }

  return (
    <Modal
      isOpen={true}
      onClose={onRequestClose}
      title={isEdit ? 'Edit GitHub Credentials' : 'Add GitHub Credentials'}
    >
      <form className="space-y-3" onSubmit={onSubmit}>
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <Input
            id="name"
            name="name"
            placeholder="Personal / Work / Org"
            value={form.name}
            onChange={onChange}
          />
        </div>
        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-1">
            Username
          </label>
          <Input
            id="username"
            name="username"
            placeholder="your-github-username"
            value={form.username}
            onChange={onChange}
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            E-mail
          </label>
          <Input
            id="email"
            name="email"
            placeholder="your@email.com"
            value={form.email}
            onChange={onChange}
          />
        </div>
        <div>
          <label htmlFor="token" className="block text-sm font-medium mb-1">
            Personal Access Token
          </label>
          <Input
            id="token"
            name="token"
            placeholder="ghp_..."
            value={form.token}
            onChange={onChange}
            type="password"
          />
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
            Token is stored securely in the main process.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onRequestClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  )
}
