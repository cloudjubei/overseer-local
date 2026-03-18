import React, { useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { ProjectWizardTypeStep } from './ProjectWizardTypeStep'

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

  if (!isOpen) return null

  return (
    <Modal
      title={step === 1 ? 'Add Project' : flowType === 'create' ? 'Create New Project' : 'Import Project'}
      onClose={onClose}
      isOpen={isOpen}
      size="lg"
    >
      <div className="relative min-h-[400px] flex flex-col">
        {step === 1 && (
          <ProjectWizardTypeStep onSelect={handleSelectType} />
        )}
        {step === 2 && (
          <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
            {/* Placeholder for future steps */}
            <p>Next steps will be implemented here.</p>
            <div className="mt-4 flex gap-4">
              <button className="btn btn-secondary" onClick={handleBack}>Back</button>
              <button className="btn btn-primary" onClick={onComplete}>Finish (Mock)</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
