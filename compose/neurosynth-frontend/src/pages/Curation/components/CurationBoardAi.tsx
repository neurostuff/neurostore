import { Box } from '@mui/material';
import CurationBoardAIGroupsList, { IGroupListItem } from 'pages/Curation/components/CurationBoardAIGroupsList';
import CurationBoardAIInterface from 'pages/Curation/components/CurationBoardAIInterface';
import { useCallback, useState } from 'react';
import CurationBoardAIInterfaceExclude from './CurationBoardAIInterfaceExclude';
import CurationBoardAIInterfaceCurator from './CurationBoardAIInterfaceCurator';
import CurationBoardAIInterfaceImportSummary from './CurationBoardAIInterfaceImportSummary';
import { NAVBAR_HEIGHT } from 'components/Navbar/Navbar';

export enum ECurationBoardAIInterface {
    CURATOR = 'CURATOR', // basic curation interface with ability to toggle between spreadsheet and focused UIs.
    IMPORT_SUMMARY = 'IMPORT_SUMMARY', // see summary of your import (time, keywords, method, etc)
    EXCLUDE = 'EXCLUDE', // exclusion view
}

const CurationBoardAI: React.FC = () => {
    const [selectedGroup, setSelectedGroup] = useState<IGroupListItem>();

    return (
        <Box
            sx={{
                display: 'flex',
                backgroundColor: 'rgb(242, 242, 242)',
                padding: '18px',
                height: `calc(100vh - 40px - ${NAVBAR_HEIGHT}px - 64px - 36px)`,
            }}
        >
            <Box sx={{ width: '20%', minWidth: '200px', height: '100%' }}>
                <CurationBoardAIGroupsList selectedGroup={selectedGroup} onSelectGroup={setSelectedGroup} />
            </Box>
            <Box sx={{ width: '80%', height: '100%', backgroundColor: 'rgb(255, 255, 255)' }}>
                {selectedGroup === undefined ? (
                    <>No Group Selected</>
                ) : selectedGroup.UI === ECurationBoardAIInterface.CURATOR ? (
                    <CurationBoardAIInterfaceCurator group={selectedGroup} />
                ) : selectedGroup.UI === ECurationBoardAIInterface.EXCLUDE ? (
                    <CurationBoardAIInterfaceExclude />
                ) : selectedGroup.UI === ECurationBoardAIInterface.IMPORT_SUMMARY ? (
                    <CurationBoardAIInterfaceImportSummary />
                ) : (
                    <CurationBoardAIInterface />
                )}
            </Box>
        </Box>
    );
};

export default CurationBoardAI;
