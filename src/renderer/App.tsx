
import { createRoot } from 'react-dom/client';
import TasksListView from './TasksListView';


const App = () => {
    
    return (        
        <div style={{ fontFamily: 'sans-serif' }}>
            <h1>Project Tasks</h1>

            <TasksListView />
        </div>
    );
}


const container = document.getElementById("root");
if (container) {
    const root = createRoot(container);
    root.render(<App/>);
}