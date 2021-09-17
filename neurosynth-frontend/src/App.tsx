import Navbar from './components/Navbar/Navbar';
import BaseNavigation from './pages/BaseNavigation/BaseNavigation';
import { BrowserRouter } from 'react-router-dom';
import { GlobalContextProvider } from './contexts/GlobalContext';

function App() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <GlobalContextProvider>
                <BrowserRouter>
                    <Navbar />
                    <BaseNavigation />
                </BrowserRouter>
            </GlobalContextProvider>
        </div>
    );
}

export default App;
