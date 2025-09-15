declare module 'thefactory-db' {
  export type DocumentInput = {
    id?: string;
    projectId?: string;
    type?: string;
    path?: string;
    content: string;
    contentHash?: string;
    metadata?: any;
  };

  export type Document = DocumentInput & { id: string };

  export function openDatabase(opts: { connectionString: string }): Promise<any>;
  export function addDocument(input: DocumentInput): Promise<Document>;
  export function updateDocument(id: string, patch: Partial<DocumentInput>): Promise<Document>;
  export function getDocumentById(id: string): Promise<Document>;
}
