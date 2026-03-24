import React, { useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { ProjectWizardTypeStep } from './ProjectWizardTypeStep'
import { ProjectWizardCreateStep, ProjectWizardCreateState } from './ProjectWizardCreateStep'
import { ProjectWizardGroupStep, ProjectWizardGroupState } from './ProjectWizardGroupStep'
import { ProjectWizardCodeStep, ProjectWizardCodeState } from './ProjectWizardCodeStep'
import { ProjectWizardGitStep, ProjectWizardGitState } from './ProjectWizardGitStep'
import { projectsService } from '@renderer/services/projectsService'
import { gitService } from '@renderer/services/gitService'
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
  
  // States for each step
  const [createData, setCreateData] = useState<ProjectWizardCreateState | null>(null)
  const [groupData, setGroupData] = useState<ProjectWizardGroupState>({ groupIds: [] })
  const [codeData, setCodeData] = useState<ProjectWizardCodeState | null>(null)
  const [gitData, setGitData] = useState<ProjectWizardGitState | null>(null)
  
  const [isValid, setIsValid] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

  const { setProjectGroup } = useProjectsGroups()

  React.useEffect(() => {
    if (initialGroupId && !groupData.groupIds.includes(initialGroupId)) {
      setGroupData(prev => ({ ...prev, groupIds: [...prev.groupIds, initialGroupId] }))
    }
  }, [initialGroupId, groupData.groupIds])

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setFlowType(null)
      setCreateData(null)
      setGroupData({ groupIds: initialGroupId ? [initialGroupId] : [] })
      setCodeData(null)
      setGitData(null)
      setIsValid(false)
      setIsSaving(false)
      setError(null)
      setCreatedProjectId(null)
    }
  }, [isOpen, initialGroupId])

  const handleSelectType = (type: WizardFlowType) => {
    setFlowType(type)
    setStep(2)
  }

  const handleBack = () => {
    if (step > 1) {
      if (step === 2) {
        setFlowType(null)
      }
      // If we've already created the project, maybe we shouldn't allow going back to step 2?
      // Actually, standard wizards usually lock the creation step once done, but for now we'll just allow navigating if it's UI only.
      // Since it creates the project on "Next" from Step 2, if they go back and change something, it's tricky.
      // Let's just allow going back for now and only create if createdProjectId is null.
      setStep(step - 1)
    }
  }

  const handleNext = async () => {
    if (step === 2 && flowType === 'create') {
      if (!createData) return
      
      if (!createdProjectId) {
        setIsSaving(true)
        setError(null)
        try {
          const payload = {
            id: createData.id,
            title: createData.title,
            path: createData.path,
            description: createData.description || '',
            metadata: { icon: createData.icon },
            active: true,
            mainGroupId: initialGroupId || undefined,
          }
          
          const newProject = await projectsService.createProject(payload)
          setCreatedProjectId(newProject?.id || payload.id)
          setStep(3)
        } catch (e: any) {
          setError(e?.message || String(e))
          return
        } finally {
          setIsSaving(false)
        }
      } else {
        // Already created, just move to next
        setStep(3)
      }
    } else if (step === 3) {
      setStep(4)
    } else if (step === 4) {
      setStep(5)
    }
  }

  const handleFinish = async () => {
    if (flowType === 'import') {
      // Not implemented in this feature
      onComplete()
      return
    }

    if (!createdProjectId) {
      onComplete()
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const patch: any = {}
      if (groupData.groupIds.length > 0) {
        patch.scopeGroupIds = groupData.groupIds
        // Also ensure mainGroupId is set if not already
        patch.mainGroupId = groupData.groupIds[0]
      }
      
      if (codeData && codeData.isCodeProject) {
        patch.codeInfo = {
          language: codeData.language !== 'other' ? codeData.language : undefined,
          frameworks: codeData.framework ? [codeData.framework] : [],
        }
      }
      
      if (gitData && gitData.repoUrl) {
         patch.repo_url = gitData.repoUrl
      }
      
      if (Object.keys(patch).length > 0) {
         await projectsService.updateProject(createdProjectId, patch)
      }

      // If they had groupIds, call setProjectGroup for the main one just to be safe with contexts
      if (groupData.groupIds.length > 0) {
         for (const gid of groupData.groupIds) {
           await setProjectGroup(createdProjectId, gid)
         }
      }

      // Initialize Git & start monitors
      await gitService.startProject(createdProjectId, { init: gitData?.initGit })

      onComplete()
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  const getStepTitle = () => {
    if (step === 1) return 'Add Project'
    if (flowType === 'import') return 'Import Project'
    if (step === 2) return 'Create New Project'
    if (step === 3) return 'Assign Groups'
    if (step === 4) return 'Project Type'
    if (step === 5) return 'Source Control'
    return 'Add Project'
  }

  return (
    <Modal
      title={getStepTitle()}
      onClose={onClose}
      isOpen={isOpen}
      size="lg"
    >
      <div className="relative min-h-[400px] flex flex-col">
        {isSaving && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 dark:bg-neutral-900/60 backdrop-blur-[2px] rounded-lg">
            <Spinner size={32} />
            <div className="mt-4 font-medium text-neutral-900 dark:text-neutral-100">
              Saving...
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
        
        {step > 1 && (
          <div className="flex-1 flex flex-col">
            {flowType === 'create' ? (
              <div className="flex-1 flex justify-center overflow-y-auto pt-4">
                {step === 2 && (
                  <ProjectWizardCreateStep 
                    initialState={createData || undefined}
                    onStateChange={(state, valid) => {
                      setCreateData(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(state)) return prev
                        return state
                      })
                      setIsValid(valid)
                    }}
                  />
                )}
                {step === 3 && (
                  <ProjectWizardGroupStep
                    initialState={groupData}
                    onStateChange={(state, valid) => {
                      setGroupData(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(state)) return prev
                        return state
                      })
                      setIsValid(valid)
                    }}
                  />
                )}
                {step === 4 && (
                  <ProjectWizardCodeStep
                    initialState={codeData || undefined}
                    onStateChange={(state, valid) => {
                      setCodeData(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(state)) return prev
                        return state
                      })
                      setIsValid(valid)
                    }}
                  />
                )}
                {step === 5 && (
                  <ProjectWizardGitStep
                    initialState={gitData || undefined}
                    onStateChange={(state, valid) => {
                      setGitData(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(state)) return prev
                        return state
                      })
                      setIsValid(valid)
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
                <p>Import steps will be implemented here.</p>
              </div>
            )}
            
            <div className="mt-4 flex justify-between pt-4 border-t border-border">
              <button 
                className="btn btn-secondary" 
                onClick={handleBack} 
                disabled={isSaving || (step === 3 && !!createdProjectId)}
              >
                Back
              </button>
              
              {flowType === 'create' && step < 5 ? (
                <button 
                  className="btn btn-primary" 
                  onClick={handleNext} 
                  disabled={!isValid || isSaving}
                >
                  Next
                </button>
              ) : flowType === 'create' && step === 5 ? (
                <button 
                  className="btn btn-primary" 
                  onClick={handleFinish} 
                  disabled={!isValid || isSaving}
                >
                  Finish Setup
                </button>
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
