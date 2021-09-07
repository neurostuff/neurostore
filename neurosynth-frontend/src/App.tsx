import Navbar from './components/Navbar/Navbar';
import BaseNavigation from './pages/BaseNavigation/BaseNavigation';
import { BrowserRouter } from 'react-router-dom';

function App() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <BrowserRouter>
                <Navbar />
                <BaseNavigation />
            </BrowserRouter>
        </div>
    );
}

export default App;
