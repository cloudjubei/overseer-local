// Deprecated shim: prefer filesService instead.
export type DocsIndexSnapshot = import('./filesService').FilesIndexSnapshot;
export { extractPathsFromIndexTree } from './filesService';
import { filesService } from './filesService';

export const docsService = filesService;
