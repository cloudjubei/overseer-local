import React, { useState, useEffect } from 'react';
import { DocDirNode, DocFileNode, DocsIndexSnapshot } from 'src/renderer/docs/DocsBrowserView';

interface DocsBrowserViewProps {
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
}


const DocsBrowserView: React.FC<DocsBrowserViewProps> = ({ onFileSelect, selectedFile }) => {
  const [root, setRoot] = useState<DocsIndexSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocsIndex = async () => {
      try {
        setLoading(true);
        if (window.docsIndex) {
            const docsIndex = await window.docsIndex.get();
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
        const unsubscribe = window.docsIndex.subscribe((newIndex: DocsIndexSnapshot) => {
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

  if (!root || root.files.length === 0) {
    return <div>No documentation files found.</div>;
  }

  return (
    <div className="docs-browser-view">
      <FileTree root={root.tree} onFileSelect={onFileSelect} selectedFile={selectedFile} />
    </div>
  );
};

interface FileTreeProps {
    root: DocDirNode;
    onFileSelect: (path: string) => void;
    selectedFile: string | null;
}

const FileTree: React.FC<FileTreeProps> = ({ root, onFileSelect, selectedFile }) => {
    return (
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>

            {root.dirs.map(entry => (
                <FileTree key={entry.name} root={entry} onFileSelect={onFileSelect} selectedFile={selectedFile} />
            ))}
            {root.files.map(entry => (
                <TreeNode key={entry.name} entry={entry} onFileSelect={onFileSelect} selectedFile={selectedFile} />
            ))}
        </ul>
    );
};

interface TreeNodeProps {
    entry: DocFileNode;
    onFileSelect: (path: string) => void;
    selectedFile: string | null;
}

const TreeNode: React.FC<TreeNodeProps> = ({ entry, onFileSelect, selectedFile }) => {
    const isSelected = selectedFile === entry.absPath;

    return (
        <li style={{ paddingLeft: '1em' }}>
            <div 
              onClick={() => onFileSelect(entry.absPath)} 
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
