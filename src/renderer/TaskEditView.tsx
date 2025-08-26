import React, { useEffect, useState } from 'react';
import { Modal, AlertDialog, useToast } from './components/ui';
import { TaskForm } from './components/TaskForm';

export default function TaskEditView({ taskId }: { taskId: number }) {
  const { toast } = useToast();
  const [initialValues, setInitialValues] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const idx = await window.tasksIndex.getSnapshot();
        const task = idx.tasksById[taskId];
        if (!task) throw new Error('Task not found');
        setInitialValues(task);
      } catch (e) {
        setAlertMessage(`Failed to load task: ${e.message}`);
        setShowAlert(true);
      }
    })();
  }, [taskId]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const res = await window.tasksIndex.updateTask(taskId, values);
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      toast({ title: 'Success', description: 'Task updated successfully', variant: 'success' });
      window.close();
    } catch (e: any) {
      setAlertMessage(`Failed to update task: ${e?.message || String(e)}`);
      setShowAlert(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!initialValues) return <div>Loading...</div>;

  return (
    <>
      <Modal title="Edit Task" onClose={() => window.close()} isOpen={true}>
        <TaskForm initialValues={initialValues} onSubmit={onSubmit} onCancel={() => window.close()} submitting={submitting} isCreate={false} />
      </Modal>
      <AlertDialog isOpen={showAlert} onClose={() => setShowAlert(false)} description={alertMessage} />
    </>
  );
}
