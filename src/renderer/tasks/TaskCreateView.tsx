import React, { useCallback, useEffect, useState } from 'react';
import { Modal, AlertDialog, useToast } from '../components/ui';
import { TaskForm } from '../components/TaskForm';

function useNextTaskId() {
  const [nextId, setNextId] = useState<number>(1);
  useEffect(() => {
    let unsub: null | (() => void) = null;
    (async () => {
      try {
        const idx = await window.tasksIndex.getSnapshot();
        const ids = Object.values(idx?.tasksById || {}).map(t => t.id).filter((n) => Number.isInteger(n));
        const max = ids.length > 0 ? Math.max(...ids) : 0;
        setNextId((max + 1) || 1);
      } catch (_) {}
      try {
        unsub = window.tasksIndex.onUpdate((i) => {
          const ids = Object.values(i?.tasksById || {}).map((t: any) => t.id).filter((n: any) => Number.isInteger(n));
          const max = ids.length > 0 ? Math.max(...ids) : 0;
          setNextId((max + 1) || 1);
        });
      } catch (_) {}
    })();
    return () => { try { unsub && unsub(); } catch (_) {} };
  }, []);
  return nextId;
}

export default function TaskCreateView() {
  const { toast } = useToast();
  const defaultId = useNextTaskId();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async (values) => {
    if (!Number.isInteger(values.id) || values.id <= 0) {
      setAlertMessage('Please provide a valid positive integer ID');
      setShowAlert(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await window.tasksIndex.addTask(values);
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      toast({ title: 'Success', description: 'Task created successfully', variant: 'success' });
      window.close();
    } catch (e: any) {
      setAlertMessage(`Failed to create task: ${e?.message || String(e)}`);
      setShowAlert(true);
    } finally {
      setSubmitting(false);
    }
  }, [toast]);

  return (
    <>
      <Modal title="Create New Task" onClose={() => window.close()} isOpen={true}>
        <TaskForm initialValues={{ id: defaultId }} onSubmit={onSubmit} onCancel={() => window.close()} submitting={submitting} isCreate={true} />
      </Modal>
      <AlertDialog isOpen={showAlert} onClose={() => setShowAlert(false)} description={alertMessage} />
    </>
  );
}
