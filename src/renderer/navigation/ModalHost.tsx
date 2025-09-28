import React from 'react'
import { createPortal } from 'react-dom'
import { useNavigator } from './Navigator'
import StoryCreateView from '../screens/stories/StoryCreateView'
import StoryEditView from '../screens/stories/StoryEditView'
import FeatureCreateView from '../screens/stories/FeatureCreateView'
import FeatureEditView from '../screens/stories/FeatureEditView'
import SettingsLLMConfigModal from '../../settings/SettingsLLMConfigModal'
import SettingsGitHubCredentialsModal from '../../settings/SettingsGitHubCredentialsModal'
import ProjectManagerModal from '../projects/ProjectManagerModal'

export default function ModalHost() {
  const { modal, closeModal } = useNavigator()
  if (!modal) return null

  let content: React.ReactNode = null
  switch (modal.type) {
    case 'story-create':
      content = <StoryCreateView onRequestClose={closeModal} />
      break
    case 'story-edit':
      content = <StoryEditView storyId={modal.storyId} onRequestClose={closeModal} />
      break
    case 'feature-create':
      content = (
        <FeatureCreateView
          storyId={modal.storyId}
          onRequestClose={closeModal}
          initialValues={modal.initialValues}
          focusDescription={modal.focusDescription}
        />
      )
      break
    case 'feature-edit':
      content = (
        <FeatureEditView
          storyId={modal.storyId}
          featureId={modal.featureId}
          onRequestClose={closeModal}
        />
      )
      break
    case 'llm-config-add':
      content = <SettingsLLMConfigModal mode="add" onRequestClose={closeModal} />
      break
    case 'llm-config-edit':
      content = <SettingsLLMConfigModal mode="edit" id={modal.id} onRequestClose={closeModal} />
      break
    case 'github-credentials-add':
      content = <SettingsGitHubCredentialsModal mode="add" onRequestClose={closeModal} />
      break
    case 'github-credentials-edit':
      content = (
        <SettingsGitHubCredentialsModal mode="edit" id={modal.id} onRequestClose={closeModal} />
      )
      break
    case 'projects-manage':
      content = (
        <ProjectManagerModal
          onRequestClose={closeModal}
          initialMode={modal.mode}
          initialProjectId={modal.projectId}
        />
      )
      break
    default:
      content = null
  }

  if (!content) return null

  return createPortal(<>{content}</>, document.body)
}
