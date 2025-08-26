// src/renderer/App.tsx

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Feature, Task } from 'src/types/tasks';


// A simple type definition for the index structure, adjust if needed
interface TasksIndex {
    tasksById: { [key: number]: Task };
    featuresByKey: { [key: string]: Feature };
    errors: any[];
}
const App = () => {
    const [tasksIndex, setTasksIndex] = useState<TasksIndex | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const handleIndexUpdate = (index: TasksIndex) => {
            setTasksIndex(index);
        };

        const fetchInitialData = async () => {
            try {
                const initialIndex = await window.tasksIndex.getSnapshot();
                if (initialIndex) {
                    handleIndexUpdate(initialIndex);
                }
            } catch (error) {
                console.error('Failed to get initial snapshot:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();

        // --- PUSH ---
        // Subscribe to any subsequent updates from the main process.
        const unsubscribe = window.tasksIndex.onUpdate(handleIndexUpdate);

        // Cleanup: The returned function will be called when the component unmounts.
        // This is crucial to prevent memory leaks.
        return () => {
            unsubscribe();
        };
    }, []); // The empty dependency array [] ensures this runs only once on mount.

    if (loading) {
        return <div>Loading tasks...</div>;
    }
    
    if (!tasksIndex) {
        return <div>Could not load tasks index.</div>
    }

    const tasks = Object.values(tasksIndex.tasksById).sort((a, b) => a.id - b.id);

    return (        
        <div style={{ fontFamily: 'sans-serif' }}>
            <h1>Project Tasks</h1>


            {/* This is the error display you were seeing */}
            {tasksIndex.errors.length > 0 && (
                <div style={{ color: 'red', background: '#fee', border: '1px solid red', padding: '10px', margin: '10px' }}>
                    <h3>Indexing Errors:</h3>
                    <pre>{JSON.stringify(tasksIndex.errors, null, 2)}</pre>
                </div>
            )}

            {/* Now, display your tasks */}
            <h2>Tasks ({Object.keys(tasksIndex.tasksById).length})</h2>
             {tasks.map(task => (
                <TaskItem key={task.id} task={task} />
            ))}
        </div>
    );
}

const FeatureItem = ({ task, feature }: { task: Task, feature: Feature }) => {
    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete feature "${feature.title}"?\nThis action cannot be undone.`)) {
            // const result = await window.tasksIndex.deleteFeature(task.id, feature.id);
            // if (!result.ok) {
            //     alert(`Error deleting feature: ${result.error}`);
            //     console.error('Failed to delete feature:', result.error);
            // }
        }
    };

    return (
        <li style={{ border: '1px solid #ccc', borderRadius: '4px', margin: '8px 0', padding: '8px', listStyle: 'none' }}>
            <strong>{feature.id}: {feature.title}</strong> <code>[{feature.status}]</code>
            <p style={{ margin: '4px 0' }}>{feature.description}</p>
            {feature.dependencies && feature.dependencies.length > 0 && (
                <p style={{ fontSize: '0.9em', color: '#555' }}>Depends on: {feature.dependencies.join(', ')}</p>
            )}
            <button onClick={handleDelete} style={{ color: 'red', background: 'none', border: '1px solid red', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                Delete
            </button>
        </li>
    );
};

const TaskItem = ({ task }: { task: Task }) => {
    return (
        <div style={{ border: '1px solid black', margin: '10px', padding: '10px', borderRadius: '8px' }}>
            <h2>Task {task.id}: {task.title} <code>[{task.status}]</code></h2>
            <p>{task.description}</p>
            <h3>Features:</h3>
            <ul style={{ padding: 0 }}>
                {task.features.map(feature => (
                    <FeatureItem key={feature.id} task={task} feature={feature} />
                ))}
            </ul>
        </div>
    );
};


const container = document.getElementById("root");
if (container) {
    const root = createRoot(container);
    root.render(<App/>);
}