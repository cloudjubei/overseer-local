import React, { useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { ProjectWizardTypeStep } from './ProjectWizardTypeStep'
import { ProjectWizardCreateStep, ProjectWizardCreateState } from './ProjectWizardCreateStep'
import { ProjectWizardGroupStep, ProjectWizardGroupState } from './ProjectWizardGroupStep'
import { ProjectWizardCodeStep, ProjectWizardCodeState } from './ProjectWizardCodeStep'
import { ProjectWizardGitStep, ProjectWizardGitState } from './ProjectWizardGitStep'
import { ProjectWizardImportModeStep, ImportMode } from './ProjectWizardImportModeStep'
import { ProjectWizardConfirmationStep } from './ProjectWizardConfirmationStep'
import { projectsService } from '@renderer/services/projectsService'
import { gitService } from '@renderer/services/gitService'
import { codeIntelService } from '@renderer/services/codeIntelService'
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
  const [importMode, setImportMode] = useState<ImportMode | null>(null)
  
  const [isValid, setIsValid] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

  const { setProjectGroup, setProjectScopeGroups, groups } = useProjectsGroups()

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
      setImportMode(null)
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
      setStep(step - 1)
    }
  }

  const handleNext = async () => {
    const doCreateProject = async () => {
      if (!createData) return false
      
      if (!createdProjectId) {
        setIsSaving(true)
        setError(null)
        try {
          const initialMainGroup = initialGroupId
            ? groups.find((g) => g.id === initialGroupId && g.type === 'MAIN')
            : undefined

          const payload = {
            id: createData.id,
            title: createData.title,
            path: createData.path,
            description: createData.description || '',
            repo_url: '',
            metadata: { icon: createData.icon },
            active: true,
            mainGroupId: initialMainGroup?.id,
          }
          
          const newProject = await projectsService.createProject(payload)
          if (!newProject?.id) {
            throw new Error('Project creation did not return a created project.')
          }
          setCreatedProjectId(newProject.id)
          return true
        } catch (e: any) {
          setError(e?.message || String(e))
          return false
        } finally {
          setIsSaving(false)
        }
      } else {
        return true
      }
    }

    if (flowType === 'create') {
      if (step === 2) {
        const success = await doCreateProject()
        if (success) setStep(3)
      } else if (step === 3) {
        setStep(4)
      } else if (step === 4) {
        setStep(5)
      }
    } else if (flowType === 'import') {
      if (step === 2) {
        setStep(3)
      } else if (step === 3) {
        const success = await doCreateProject()
        if (success) setStep(4)
      } else if (step === 4) {
        setStep(5)
      } else if (step === 5) {
        setStep(6)
      } else if (step === 6) {
        setStep(7)
      }
    }
  }

  const handleFinish = async () => {
    if (!createdProjectId) {
      onComplete()
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const patch: any = {}
      
      const scopeGroupIds = groupData.groupIds.filter(id => {
        const group = groups.find(g => g.id === id)
        return group?.type === 'SCOPE'
      })

      const mainGroupId = groupData.groupIds.find(id => {
        const group = groups.find(g => g.id === id)
        return group?.type === 'MAIN'
      }) || initialGroupId

      if (scopeGroupIds.length > 0) {
        patch.scopeGroupIds = scopeGroupIds
      }
      if (mainGroupId) {
        patch.mainGroupId = mainGroupId
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

      if (mainGroupId) {
        await setProjectGroup(createdProjectId, mainGroupId)
      }
      await setProjectScopeGroups(createdProjectId, scopeGroupIds)

      try {
        await gitService.startProject(createdProjectId, { init: gitData?.initGit })
      } catch (gitError) {
        console.warn('[ProjectWizardModal] git start failed during project creation', gitError)
      }

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
    if (flowType === 'import' && step === 2) return 'Import Mode'
    if (flowType === 'import' && step === 7) return 'Confirm Import'
    if (step === 2 && flowType === 'create') return 'Create New Project'
    if (step === 3 && flowType === 'import') return 'Review Project Details'
    if ((step === 3 && flowType === 'create') || (step === 4 && flowType === 'import')) return 'Assign Groups'
    if ((step === 4 && flowType === 'create') || (step === 5 && flowType === 'import')) return 'Project Type'
    if ((step === 5 && flowType === 'create') || (step === 6 && flowType === 'import')) return 'Source Control'
    return 'Add Project'
  }

  const isFinalStep = (flowType === 'create' && step === 5) || (flowType === 'import' && step === 7)

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
            <div className="flex-1 flex justify-center overflow-y-auto pt-4">
              {flowType === 'import' && step === 2 && (
                <ProjectWizardImportModeStep
                  onStateChange={(data, valid) => {
                    if (data) {
                      setImportMode(data.importMode)
                      if (data.createData) setCreateData(prev => ({ ...prev, ...data.createData }) as ProjectWizardCreateState)
                      if (data.codeData) setCodeData(prev => ({ ...prev, ...data.codeData }) as ProjectWizardCodeState)
                      if (data.gitData) setGitData(prev => ({ ...prev, ...data.gitData }) as ProjectWizardGitState)
                    }
                    setIsValid(valid)
                  }}
                />
              )}

              {((step === 2 && flowType === 'create') || (step === 3 && flowType === 'import')) && (
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

              {((step === 3 && flowType === 'create') || (step === 4 && flowType === 'import')) && (
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

              {((step === 4 && flowType === 'create') || (step === 5 && flowType === 'import')) && (
                <ProjectWizardCodeStep
                  projectPath={createData?.path}
                  detectEnvironment={codeIntelService.detectEnvironment}
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

              {((step === 5 && flowType === 'create') || (step === 6 && flowType === 'import')) && (
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

              {flowType === 'import' && step === 7 && (
                <ProjectWizardConfirmationStep
                  importMode={importMode!}
                  createData={createData}
                  codeData={codeData}
                  gitData={gitData}
                />
              )}
            </div>
            
            <div className="mt-4 flex justify-between pt-4 border-t border-border">
              <button 
                className="btn btn-secondary" 
                onClick={handleBack} 
                disabled={isSaving || ((flowType === 'create' && step === 3) || (flowType === 'import' && step === 4)) && !!createdProjectId}
              >
                Back
              </button>
              
              {!isFinalStep ? (
                <button 
                  className="btn btn-primary" 
                  onClick={handleNext} 
                  disabled={!isValid || isSaving}
                >
                  Next
                </button>
              ) : (
                <button 
                  className="btn btn-primary" 
                  onClick={handleFinish} 
                  disabled={!isValid || isSaving}
                >
                  Finish Setup
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
