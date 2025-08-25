export {};

declare global {
  interface TasksIndexAPI {
    getSnapshot(): Promise<any>;
    onUpdate(cb: (data: any) => void): () => void;
    updateTask(taskId: number, data: { title?: string; description?: string }): Promise<{ ok: boolean; error?: string }>;
    updateFeature(taskId: number, featureId: string, data: any): Promise<{ ok: boolean; error?: string }>;
    addFeature(taskId: number, feature: any): Promise<{ ok: boolean; error?: string }>;
    addTask(task: { id?: number; status?: string; title?: string; description?: string }): Promise<{ ok: boolean; id?: number; error?: string }>;
    openFeatureCreate(taskId: number): Promise<{ ok: boolean; error?: string }>;
    openTaskCreate(): Promise<{ ok: boolean; error?: string }>;
  }
  interface Window { tasksIndex: TasksIndexAPI }
}
