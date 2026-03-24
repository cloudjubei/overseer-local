import React, { useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { ProjectWizardTypeStep } from './ProjectWizardTypeStep'
import { ProjectWizardCreateStep, ProjectWizardCreateState } from './ProjectWizardCreateStep'
import { projectsService } from '@renderer/services/projectsService'
import { useProjectsGroups } from '@renderer/contexts/ProjectsGroupsContext'
import Spinner from '@renderer/components/ui/Spinner'

export type WizardFlowType = 'create' | 'import' | null

interface ProjectWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  initialGroupId: string | null
}

export function ProjectWizardModal({ isOpen, onClose, onComplete, initialGroupId }: ProjectWizardModalProps) {
  const [step, setStep] = useState<number>(1)
  const [flowType, setFlowType] = useState<WizardFlowType>(null)
  const [createData, setCreateData] = useState<ProjectWizardCreateState | null>(null)
  const [isValid, setIsValid] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { setProjectGroup } = useProjectsGroups()

  const handleSelectType = (type: WizardFlowType) => {
    setFlowType(type)
    setStep(2)
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
      if (step === 2) {
        setFlowType(null)
      }
    }
  }

  const handleCreateFinish = async () => {
    if (!createData) return
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        id: createData.id,
        title: createData.title,
        path: createData.path,
        metadata: { icon: createData.icon },
        active: true,
        mainGroupId: initialGroupId || undefined,
      }
      
      await projectsService.createProject(payload)
      
      if (initialGroupId) {
        await setProjectGroup(payload.id, initialGroupId)
      }
      
      onComplete()
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      title={step === 1 ? 'Add Project' : flowType === 'create' ? 'Create New Project' : 'Import Project'}
      onClose={onClose}
      isOpen={isOpen}
      size="lg"
    >
      <div className="relative min-h-[400px] flex flex-col">
        {isSaving && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 dark:bg-neutral-900/60 backdrop-blur-[2px] rounded-lg">
            <Spinner size={32} />
            <div className="mt-4 font-medium text-neutral-900 dark:text-neutral-100">
              Creating Project...
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md text-sm">
            {error}
          </div>
        )}

        {step === 1 && (
          <ProjectWizardTypeStep onSelect={handleSelectType} />
        )}
        
        {step === 2 && (
          <div className="flex-1 flex flex-col">
            {flowType === 'create' ? (
              <div className="flex-1 overflow-y-auto">
                <ProjectWizardCreateStep 
                  initialState={createData || undefined}
                  onStateChange={(state, valid) => {
                    setCreateData(state)
                    setIsValid(valid)
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
                <p>Import steps will be implemented here.</p>
              </div>
            )}
            
            <div className="mt-4 flex justify-between pt-4 border-t border-border">
              <button className="btn btn-secondary" onClick={handleBack} disabled={isSaving}>Back</button>
              {flowType === 'create' ? (
                <button className="btn btn-primary" onClick={handleCreateFinish} disabled={!isValid || isSaving}>Create Project</button>
              ) : (
                <button className="btn btn-primary" onClick={onComplete}>Finish (Mock)</button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
