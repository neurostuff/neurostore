import Navbar from './components/Navbar/Navbar';
import BaseNavigation from './pages/BaseNavigation/BaseNavigation';
import { BrowserRouter } from 'react-router-dom';
import { GlobalContextProvider } from './contexts/GlobalContext';

function App() {
    return (
        <GlobalContextProvider>
            <BrowserRouter>
                <Navbar />
                <BaseNavigation />
            </BrowserRouter>
        </GlobalContextProvider>
    );
}

export default App;
