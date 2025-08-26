export {};

declare global {
  interface Window {
    tasksIndex: {
      getSnapshot: () => Promise<any>;
      onUpdate: (callback: (index: any) => void) => void;
      updateTask: (taskId: string, data: any) => Promise<any>;
      updateFeature: (taskId: string, featureId: string, data: any) => Promise<any>;
      addFeature: (taskId: string, feature: any) => Promise<any>;
      reorderFeatures: (taskId: string, payload: any) => Promise<any>;
      reorderTasks: (payload: any) => Promise<any>;
      addTask: (task: any) => Promise<any>;
      openFeatureCreate: (taskId: string) => Promise<any>;
      openTaskCreate: () => Promise<any>;
    };
    api: {
      docsGetContent: (filePath: string) => Promise<string>;
    };
  }
}
