import Navbar from './components/Navbar/Navbar';
import BaseNavigation from './pages/BaseNavigation/BaseNavigation';
import { BrowserRouter } from 'react-router-dom';
import { GlobalContextProvider } from './contexts/GlobalContext';
import { Box } from '@mui/system';

function App() {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <GlobalContextProvider>
                <BrowserRouter>
                    <Navbar />
                    <BaseNavigation />
                </BrowserRouter>
            </GlobalContextProvider>
        </Box>
    );
}

export default App;
