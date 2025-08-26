import React, { useEffect, useState } from 'react';
import { Modal, AlertDialog, useToast } from '../components/ui';
import { FeatureForm } from '../components/FeatureForm';

export default function FeatureEditView({ taskId, featureId }: { taskId: number; featureId: string }) {
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
        const feature = task.features.find(f => f.id === featureId);
        if (!feature) throw new Error('Feature not found');
        setInitialValues(feature);
      } catch (e) {
        setAlertMessage(`Failed to load feature: ${e.message}`);
        setShowAlert(true);
      }
    })();
  }, [taskId, featureId]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const res = await window.tasksIndex.updateFeature(taskId, featureId, values);
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      toast({ title: 'Success', description: 'Feature updated successfully', variant: 'success' });
      window.close();
    } catch (e: any) {
      setAlertMessage(`Failed to update feature: ${e?.message || String(e)}`);
      setShowAlert(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!initialValues) return <div>Loading...</div>;

  return (
    <>
      <Modal title="Edit Feature" onClose={() => window.close()} isOpen={true}>
        <FeatureForm initialValues={initialValues} onSubmit={onSubmit} onCancel={() => window.close()} submitting={submitting} isCreate={false} />
      </Modal>
      <AlertDialog isOpen={showAlert} onClose={() => setShowAlert(false)} description={alertMessage} />
    </>
  );
}
