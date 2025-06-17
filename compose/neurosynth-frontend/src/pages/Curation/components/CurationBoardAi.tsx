import { Box } from '@mui/material';
import { NAVBAR_HEIGHT } from 'components/Navbar/Navbar';
import { useSnackbar } from 'notistack';
import CurationBoardAIGroupsList from 'pages/Curation/components/CurationBoardAIGroupsList';
import { useDeleteCurationImport } from 'pages/Project/store/ProjectStore';
import useCurationBoardGroupsState from '../hooks/useCurationBoardGroupsState';
import CurationBoardAIInterfaceCurator from './CurationBoardAIInterfaceCurator';
import CurationBoardAIInterfaceExclude from './CurationBoardAIInterfaceExclude';
import CurationBoardAIInterfaceImportSummary from './CurationBoardAIInterfaceImportSummary';
import InfoPopup from 'components/InfoPopup';

export enum ECurationBoardAIInterface {
    CURATOR = 'CURATOR', // basic curation interface with ability to toggle between spreadsheet and focused UIs.
    IMPORT_SUMMARY = 'IMPORT_SUMMARY', // see summary of your import (time, keywords, method, etc)
    EXCLUDE = 'EXCLUDE', // exclusion view
}

const CurationBoardAI: React.FC = () => {
    const deleteCurationImport = useDeleteCurationImport();
    const { enqueueSnackbar } = useSnackbar();
    const { groups, selectedGroup, handleSetSelectedGroup } = useCurationBoardGroupsState();

    const handleDeleteCurationImport = (importId: string) => {
        deleteCurationImport(importId);
        handleSetSelectedGroup(groups[1]);
        enqueueSnackbar(`Deleted import`, { variant: 'success' });
    };

    return (
        <Box
            sx={{
                display: 'flex',
                backgroundColor: 'rgb(242, 242, 242)',
                padding: '18px',
                height: `calc(100vh - 40px - ${NAVBAR_HEIGHT}px - 64px - 4px)`, // add 4px for a bit of padding at the bottom
            }}
        >
            {/* eventually remove this */}
            <InfoPopup />
            <Box sx={{ width: '20%', minWidth: '200px', height: '100%' }}>
                <CurationBoardAIGroupsList
                    groups={groups}
                    selectedGroup={selectedGroup}
                    onSelectGroup={handleSetSelectedGroup}
                />
            </Box>
            <Box
                sx={{
                    width: '80%',
                    overflow: 'hidden',
                    height: '100%',
                    backgroundColor: 'rgb(255, 255, 255)',
                }}
            >
                {selectedGroup === undefined ? (
                    <Box color="warning.dark" padding={1}>
                        No Group Selected
                    </Box>
                ) : selectedGroup.UI === ECurationBoardAIInterface.CURATOR ? (
                    <CurationBoardAIInterfaceCurator group={selectedGroup} />
                ) : selectedGroup.UI === ECurationBoardAIInterface.EXCLUDE ? (
                    <CurationBoardAIInterfaceExclude group={selectedGroup} />
                ) : selectedGroup.UI === ECurationBoardAIInterface.IMPORT_SUMMARY ? (
                    <CurationBoardAIInterfaceImportSummary
                        onDeleteCurationImport={handleDeleteCurationImport}
                        group={selectedGroup}
                    />
                ) : (
                    <Box color="warning.dark" padding={1}>
                        No Group Selected
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default CurationBoardAI;
