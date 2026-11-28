import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState, type MutableRefObject, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UseCreateFromTemplateForm } from 'thefactory-ui/headless'
import ProjectManagerModal from './ProjectManagerModal'

const formCtl = vi.hoisted(() => ({
  submitting: false,
  canSubmit: false,
  abort: vi.fn(async () => undefined),
  /** Re-render the mocked CreateFromTemplateForm so it rewrites formRef.current. */
  republish: null as null | (() => void),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('thefactory-ui/headless', () => ({
  CREATE_FROM_TEMPLATE_COPY: {
    create: 'Create',
    abort: 'Cancel',
  },
  useProjects: () => ({ projects: [], refresh: vi.fn() }),
  useProjectsGroups: () => ({ groups: [], reorderProject: vi.fn(), refresh: vi.fn() }),
  useProjectGithubRepo: () => ({
    ready: false,
    validationError: null,
    connected: false,
    enabled: false,
    setEnabled: vi.fn(),
    repoName: '',
    setRepoName: vi.fn(),
    status: 'unknown',
    connect: vi.fn(),
    connecting: false,
  }),
  projectCheckEnvError: () => null,
}))

vi.mock('thefactory-ui/headless/api', () => ({
  createProject: vi.fn(),
  createProjectGithubRepo: vi.fn(),
  deleteProject: vi.fn(),
  updateProject: vi.fn(),
  extractErrorMessage: (err: unknown) => String(err),
}))

vi.mock('thefactory-ui/web/icons', () => ({
  IconArrowLeftMini: () => null,
  IconArrowRightMini: () => null,
  IconBack: () => null,
  IconDelete: () => null,
  IconEdit: () => null,
  IconPlus: () => null,
  IconSave: () => null,
}))

vi.mock('thefactory-ui/web', () => {
  const blankForm = (): {
    id: string
    title: string
    description: string
    repo_url: string
    active: boolean
    metadata: Record<string, unknown>
    codeInfo: undefined
    mainGroupId: null
    scopeGroupIds: string[]
  } => ({
    id: '',
    title: '',
    description: '',
    repo_url: '',
    active: true,
    metadata: {},
    codeInfo: undefined,
    mainGroupId: null,
    scopeGroupIds: [],
  })

  function stubFormController(): UseCreateFromTemplateForm {
    return {
      template: null,
      setTemplate: vi.fn(),
      name: '',
      setName: vi.fn(),
      id: '',
      setId: vi.fn(),
      idAvailability: 'empty',
      mainGroupId: null,
      setMainGroupId: vi.fn(),
      mainGroups: [],
      github: {} as UseCreateFromTemplateForm['github'],
      errors: [],
      submitting: formCtl.submitting,
      canSubmit: formCtl.canSubmit,
      progress: null,
      progressLabel: '',
      submit: vi.fn(async () => undefined),
      abort: formCtl.abort,
      copy: { create: 'Create', abort: 'Cancel' } as UseCreateFromTemplateForm['copy'],
    }
  }

  return {
    Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Button: ({
      children,
      disabled,
      loading,
      onClick,
      type,
      form,
      title,
      'aria-label': ariaLabel,
    }: {
      children?: ReactNode
      disabled?: boolean
      loading?: boolean
      onClick?: () => void
      type?: 'button' | 'submit'
      form?: string
      title?: string
      'aria-label'?: string
    }) => (
      <button
        type={type ?? 'button'}
        form={form}
        title={title}
        aria-label={ariaLabel}
        disabled={Boolean(disabled || loading)}
        aria-busy={loading || undefined}
        onClick={onClick}
      >
        {children}
      </button>
    ),
    ConfirmDialog: () => null,
    CreateFromTemplateForm: ({
      formRef,
    }: {
      formRef?: MutableRefObject<UseCreateFromTemplateForm | null>
    }) => {
      const [, bump] = useState(0)
      formCtl.republish = () => bump((n) => n + 1)
      if (formRef) formRef.current = stubFormController()
      return <div data-testid="from-template-form">from-template form</div>
    },
    Modal: ({
      children,
      footer,
      title,
    }: {
      children: ReactNode
      footer?: ReactNode
      title: string
    }) => (
      <div>
        <h1>{title}</h1>
        {children}
        <div data-testid="footer">{footer}</div>
      </div>
    ),
    ProjectEditorForm: () => null,
    ProjectGroupsEditor: () => null,
    Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectValue: () => null,
    Spinner: () => null,
    blankProjectForm: blankForm,
    projectToFormState: () => blankForm(),
    renderProjectIcon: () => null,
  }
})

function openFromTemplate(): void {
  render(<ProjectManagerModal onRequestClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'New from template' }))
  expect(screen.getByTestId('from-template-form')).toBeVisible()
}

function createButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement
}

describe('ProjectManagerModal create-from-template host footer', () => {
  beforeEach(() => {
    formCtl.submitting = false
    formCtl.canSubmit = false
    formCtl.abort.mockReset()
    formCtl.republish = null
  })

  it('disables Create while the shared form reports canSubmit false', async () => {
    formCtl.canSubmit = false
    openFromTemplate()

    await waitFor(() => {
      expect(createButton()).toBeDisabled()
    })
  })

  it('enables Create when the shared form reports canSubmit true', async () => {
    formCtl.canSubmit = false
    openFromTemplate()
    await waitFor(() => expect(createButton()).toBeDisabled())

    formCtl.canSubmit = true
    await act(async () => {
      formCtl.republish?.()
    })

    await waitFor(() => {
      expect(createButton()).not.toBeDisabled()
    })
  })

  it('mirrors formRef submitting without polling setInterval', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    formCtl.canSubmit = true
    openFromTemplate()

    await waitFor(() => expect(createButton()).not.toBeDisabled())
    // waitFor may use setInterval; the host must not install its own 50ms poll.
    expect(
      setIntervalSpy.mock.calls.some(
        ([fn, ms]) => ms === 50 && typeof fn === 'function' && fn.name === '',
      ),
    ).toBe(false)

    formCtl.submitting = true
    formCtl.canSubmit = false
    await act(async () => {
      formCtl.republish?.()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
      expect(createButton()).toBeDisabled()
    })

    setIntervalSpy.mockRestore()
  })
})
