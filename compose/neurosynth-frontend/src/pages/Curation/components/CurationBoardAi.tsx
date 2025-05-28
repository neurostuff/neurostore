import { Box } from '@mui/material';
import { NAVBAR_HEIGHT } from 'components/Navbar/Navbar';
import CurationBoardAIGroupsList, { IGroupListItem } from 'pages/Curation/components/CurationBoardAIGroupsList';
import { useEffect, useMemo, useState } from 'react';
import CurationBoardAIInterfaceCurator from './CurationBoardAIInterfaceCurator';
import CurationBoardAIInterfaceExclude from './CurationBoardAIInterfaceExclude';
import CurationBoardAIInterfaceImportSummary from './CurationBoardAIInterfaceImportSummary';
import {
    useDeleteCurationImport,
    useProjectCurationColumns,
    useProjectCurationExclusionTags,
    useProjectCurationImports,
} from 'pages/Project/store/ProjectStore';
import { useSnackbar } from 'notistack';

export enum ECurationBoardAIInterface {
    CURATOR = 'CURATOR', // basic curation interface with ability to toggle between spreadsheet and focused UIs.
    IMPORT_SUMMARY = 'IMPORT_SUMMARY', // see summary of your import (time, keywords, method, etc)
    EXCLUDE = 'EXCLUDE', // exclusion view
}

const CurationBoardAI: React.FC = () => {
    const [selectedGroup, setSelectedGroup] = useState<IGroupListItem>();
    const deleteCurationImport = useDeleteCurationImport();
    const { enqueueSnackbar } = useSnackbar();
    const excludedGroups = useProjectCurationExclusionTags();
    const curationColumns = useProjectCurationColumns();
    const curationImports = useProjectCurationImports();

    // TODO: if isPrisma, then set exclusion tags for each curation column

    const GROUPS: IGroupListItem[] = useMemo(() => {
        if (curationColumns.length === 0) return [];
        if (curationColumns.length !== 2)
            throw new Error('Expected 2 curation columns, but got ' + curationColumns.length);

        const [unreviewedColumn, includedColumn] = curationColumns;

        const menuItems: IGroupListItem[] = [
            {
                id: 'curate_header',
                type: 'SUBHEADER',
                label: 'Curation',
                count: null,
                UI: null,
            },
            {
                id: unreviewedColumn.id,
                type: 'LISTITEM',
                label: unreviewedColumn.name,
                count: unreviewedColumn.stubStudies.filter((x) => x.exclusionTag === null).length,
                UI: ECurationBoardAIInterface.CURATOR,
                children: [],
            },
            {
                id: 'excluded_studies_column',
                type: 'LISTITEM',
                label: 'Excluded',
                count: unreviewedColumn.stubStudies.filter((x) => x.exclusionTag !== null).length,
                UI: ECurationBoardAIInterface.EXCLUDE,
                listItemStyles: {
                    '& .MuiListItemButton-root': {
                        padding: '2px 16px',
                    },
                },
                children: excludedGroups.map((excludedGroup) => {
                    const numExcludedInGroup = curationColumns.reduce((acc, curr) => {
                        return (
                            acc + curr.stubStudies.filter((study) => study.exclusionTag?.id === excludedGroup.id).length
                        );
                    }, 0);

                    return {
                        id: excludedGroup.id,
                        type: 'LISTITEM',
                        label: excludedGroup.label,
                        count: numExcludedInGroup,
                        UI: ECurationBoardAIInterface.EXCLUDE,
                        listItemStyles: {
                            color: 'error.dark',
                            '& .MuiListItemButton-root': {
                                padding: '2px 16px',
                            },
                        },
                    } as IGroupListItem;
                }),
            },
            {
                id: includedColumn.id,
                type: 'LISTITEM',
                label: includedColumn.name,
                count: includedColumn.stubStudies.filter((x) => x.exclusionTag === null).length,
                UI: ECurationBoardAIInterface.CURATOR,
                children: [],
            },
            {
                id: 'divider-1',
                type: 'DIVIDER',
                label: '',
                count: null,
                UI: null,
            },
        ];

        if (curationImports.length > 0) {
            menuItems.push(
                {
                    id: 'imports_header',
                    type: 'SUBHEADER',
                    label: 'Imports',
                    count: null,
                    UI: null,
                },
                ...curationImports
                    .map((curationImport) => {
                        const date = new Date(curationImport.date);
                        return {
                            id: curationImport.id,
                            type: 'LISTITEM',
                            label: curationImport.name,
                            secondaryLabel: `${curationImport.importModeUsed}\n${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
                            count: curationImport.numImported,
                            UI: ECurationBoardAIInterface.IMPORT_SUMMARY,
                        } as IGroupListItem;
                    })
                    .reverse()
            );
        }

        return menuItems;
    }, [curationColumns, excludedGroups, curationImports]);

    useEffect(() => {
        if (selectedGroup === undefined && curationColumns.length > 0) {
            setSelectedGroup(GROUPS[1]);
        }
    }, [GROUPS, curationColumns.length, selectedGroup]);

    const handleDeleteCurationImport = (importId: string) => {
        deleteCurationImport(importId);
        setSelectedGroup(GROUPS[1]);
        enqueueSnackbar(`Deleted import`, { variant: 'success' });
    };

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
                <CurationBoardAIGroupsList
                    groups={GROUPS}
                    selectedGroup={selectedGroup}
                    onSelectGroup={setSelectedGroup}
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
