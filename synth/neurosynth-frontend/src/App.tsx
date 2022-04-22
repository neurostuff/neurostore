import Navbar from './components/Navbar/Navbar';
import BaseNavigation from './pages/BaseNavigation/BaseNavigation';
import { BrowserRouter } from 'react-router-dom';
import { GlobalContextProvider } from './contexts/GlobalContext';
import { useEffect } from 'react';
import API from './utils/api';
import useGetToken from './hooks/useGetToken';

function App() {
    const token = useGetToken();

    useEffect(() => {
        API.UpdateServicesWithToken(token);
    }, [token]);

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
