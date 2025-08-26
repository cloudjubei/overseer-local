import React from 'react';
import { useNavigator } from './Navigator';
import TaskCreateView from '../tasks/TaskCreateView';
import TaskEditView from '../tasks/TaskEditView';
import FeatureCreateView from '../tasks/FeatureCreateView';
import FeatureEditView from '../tasks/FeatureEditView';

export default function ModalHost() {
  const { modal, closeModal } = useNavigator();
  if (!modal) return null;
  switch (modal.type) {
    case 'task-create':
      return <TaskCreateView onRequestClose={closeModal} />;
    case 'task-edit':
      return <TaskEditView taskId={modal.taskId} onRequestClose={closeModal} />;
    case 'feature-create':
      return <FeatureCreateView taskId={modal.taskId} onRequestClose={closeModal} />;
    case 'feature-edit':
      return <FeatureEditView taskId={modal.taskId} featureId={modal.featureId} onRequestClose={closeModal} />;
    default:
      return null;
  }
}
