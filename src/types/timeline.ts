export interface TimelineLabel {
  id: string;
  projectId: string | null; // null for global labels
  timestamp: Date;
  label: string;
  description?: string;
}