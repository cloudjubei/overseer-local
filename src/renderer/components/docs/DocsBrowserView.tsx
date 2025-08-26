import React, { useState, useEffect } from 'react';

// These types would ideally be in a shared types file.
export interface DocFile {
  name: string;
  path: string;
  type: 'file';
}

export interface DocDir {
  name: string;
  path: string;
  type: 'directory';
  children: DocEntry[];
}

export type DocEntry = DocFile | DocDir;

interface DocsBrowserViewProps {
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
}

// This is a placeholder for the actual API exposed via preload script
declare global {
  interface Window {
    docsIndex: {
      getSnapshot: () => Promise<DocDir>;
      onUpdate: (callback: (index: DocDir) => void) => () => void;
    }
  }
}

const DocsBrowserView: React.FC<DocsBrowserViewProps> = ({ onFileSelect, selectedFile }) => {
  const [root, setRoot] = useState<DocDir | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocsIndex = async () => {
      try {
        setLoading(true);
        if (window.docsIndex) {
            const docsIndex = await window.docsIndex.getSnapshot();
            setRoot(docsIndex);
        } else {
            setError("Docs API not available on window object.");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDocsIndex();

    if (window.docsIndex) {
        const unsubscribe = window.docsIndex.onUpdate((newIndex: DocDir) => {
            setRoot(newIndex);
        });

        return () => {
            unsubscribe();
        };
    }
  }, []);
  
  if (loading) {
    return <div>Loading documentation files...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (!root || root.children.length === 0) {
    return <div>No documentation files found.</div>;
  }

  return (
    <div className="docs-browser-view">
      <FileTree root={root} onFileSelect={onFileSelect} selectedFile={selectedFile} />
    </div>
  );
};

interface FileTreeProps {
    root: DocDir;
    onFileSelect: (path: string) => void;
    selectedFile: string | null;
}

const FileTree: React.FC<FileTreeProps> = ({ root, onFileSelect, selectedFile }) => {
    return (
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
            {root.children.map(entry => (
                <TreeNode key={entry.path} entry={entry} onFileSelect={onFileSelect} selectedFile={selectedFile} />
            ))}
        </ul>
    );
};

interface TreeNodeProps {
    entry: DocEntry;
    onFileSelect: (path: string) => void;
    selectedFile: string | null;
}

const TreeNode: React.FC<TreeNodeProps> = ({ entry, onFileSelect, selectedFile }) => {
    const [isOpen, setIsOpen] = useState(true); // Default to open for simplicity

    if (entry.type === 'directory') {
        return (
            <li style={{ paddingLeft: '1em' }}>
                <div onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer' }}>
                    {isOpen ? '▾' : '▸'} 📂 {entry.name}
                </div>
                {isOpen && (
                    <ul style={{ listStyle: 'none', paddingLeft: '1em' }}>
                        {entry.children.map(child => (
                            <TreeNode key={child.path} entry={child} onFileSelect={onFileSelect} selectedFile={selectedFile} />
                        ))}
                    </ul>
                )}
            </li>
        );
    }

    const isSelected = selectedFile === entry.path;

    return (
        <li style={{ paddingLeft: '1em' }}>
            <div 
              onClick={() => onFileSelect(entry.path)} 
              style={{ 
                cursor: 'pointer',
                fontWeight: isSelected ? 'bold' : 'normal',
                backgroundColor: isSelected ? '#eee' : 'transparent'
              }}
            >
                📄 {entry.name}
            </div>
        </li>
    );
};


export default DocsBrowserView;
