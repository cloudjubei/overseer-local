import React, { useCallback, useState } from 'react';
import { Modal, AlertDialog, useToast } from '../components/ui';
import { FeatureForm } from '../components/FeatureForm';

export default function FeatureCreateView({ taskId }: { taskId: number }) {
  const { toast } = useToast();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async (values) => {
    if (!taskId || !Number.isInteger(taskId)) {
      setAlertMessage('No valid Task ID provided.');
      setShowAlert(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await window.tasksIndex.addFeature(taskId, values);
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      toast({ title: 'Success', description: 'Feature created successfully', variant: 'success' });
      window.close();
    } catch (e: any) {
      setAlertMessage(`Failed to create feature: ${e?.message || String(e)}`);
      setShowAlert(true);
    } finally {
      setSubmitting(false);
    }
  }, [taskId, toast]);

  if (!taskId) {
    return <div>Error: No Task ID provided.</div>;
  }

  return (
    <>
      <Modal title="Create New Feature" onClose={() => window.close()} isOpen={true}>
        <FeatureForm onSubmit={onSubmit} onCancel={() => window.close()} submitting={submitting} isCreate={true} />
      </Modal>
      <AlertDialog isOpen={showAlert} onClose={() => setShowAlert(false)} description={alertMessage} />
    </>
  );
}
