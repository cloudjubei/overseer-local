import React, { useEffect, useState } from 'react';

// These types would ideally be in a shared `types.ts` file
interface Feature {
    id: string;
    status: string;
    title: string;
    description: string;
    dependencies?: string[];
}

interface Task {
    id: number;
    status: string;
    title: string;
    description: string;
    features: Feature[];
}

interface TasksIndex {
    tasksById: { [key: number]: Task };
    errors: any[];
}

const FeatureItem = ({ task, feature }: { task: Task, feature: Feature }) => {
    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete feature "${feature.title}"?\nThis action cannot be undone.`)) {
            const result = await window.tasksIndex.deleteFeature(task.id, feature.id);
            if (!result.ok) {
                alert(`Error deleting feature: ${result.error}`);
                console.error('Failed to delete feature:', result.error);
            }
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

const App = () => {
    const [tasksIndex, setTasksIndex] = useState<TasksIndex | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchIndex = async () => {
            const snapshot = await window.tasksIndex.getSnapshot();
            if (isMounted) {
                setTasksIndex(snapshot);
            }
        };
        fetchIndex();

        const unsubscribe = window.tasksIndex.onUpdate((snapshot) => {
            console.log('Received tasks index update');
            if (isMounted) {
                setTasksIndex(snapshot);
            }
        });
        
        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    if (!tasksIndex) {
        return <div>Loading tasks...</div>;
    }

    const tasks = Object.values(tasksIndex.tasksById).sort((a, b) => a.id - b.id);

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <h1>Project Tasks</h1>
            {tasksIndex.errors.length > 0 && (
                <div style={{ color: 'red', background: '#fee', border: '1px solid red', padding: '10px', margin: '10px' }}>
                    <h3>Indexing Errors:</h3>
                    <pre>{JSON.stringify(tasksIndex.errors, null, 2)}</pre>
                </div>
            )}
            {tasks.map(task => (
                <TaskItem key={task.id} task={task} />
            ))}
        </div>
    );
};

export default App;
