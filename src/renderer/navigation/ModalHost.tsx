import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigator } from './Navigator';
import TaskCreateView from '../tasks/TaskCreateView';
import TaskEditView from '../tasks/TaskEditView';
import FeatureCreateView from '../tasks/FeatureCreateView';
import FeatureEditView from '../tasks/FeatureEditView';
import SettingsLLMConfigModal from '../settings/SettingsLLMConfigModal';

export default function ModalHost() {
  const { modal, closeModal } = useNavigator();
  if (!modal) return null;

  let content: React.ReactNode = null;
  switch (modal.type) {
    case 'task-create':
      content = <TaskCreateView onRequestClose={closeModal} />;
      break;
    case 'task-edit':
      content = <TaskEditView taskId={modal.taskId} onRequestClose={closeModal} />;
      break;
    case 'feature-create':
      content = <FeatureCreateView taskId={modal.taskId} onRequestClose={closeModal} />;
      break;
    case 'feature-edit':
      content = (
        <FeatureEditView taskId={modal.taskId} featureId={modal.featureId} onRequestClose={closeModal} />
      );
      break;
    case 'llm-config-add':
      content = <SettingsLLMConfigModal mode="add" onRequestClose={closeModal} />;
      break;
    case 'llm-config-edit':
      content = <SettingsLLMConfigModal mode="edit" id={modal.id} onRequestClose={closeModal} />;
      break;
    default:
      content = null;
  }

  if (!content) return null;

  // Render modals above all app content to avoid stacking context issues
  return createPortal(<>{content}</>, document.body);
}
