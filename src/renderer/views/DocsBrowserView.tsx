import React, { useState, useEffect } from 'react';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface DocsBrowserViewProps {
  filePath: string | null;
}

const DocsBrowserView: React.FC<DocsBrowserViewProps> = ({ filePath }) => {
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!filePath) {
      setContent('');
      setError(null);
      return;
    }

    const fetchDocContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const mdContent = await window.api.docsGetContent(filePath);
        setContent(mdContent);
      } catch (err) {
        console.error(`Error fetching doc: ${filePath}`, err);
        setError(`Failed to load content for ${filePath}.`);
        setContent('');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocContent();
  }, [filePath]);

  if (isLoading) {
    return <div className="p-4">Loading document...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }
  
  if (!filePath) {
    return <div className="p-4">Select a document to view.</div>;
  }

  return (
    <div className="overflow-y-auto h-full">
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default DocsBrowserView;
