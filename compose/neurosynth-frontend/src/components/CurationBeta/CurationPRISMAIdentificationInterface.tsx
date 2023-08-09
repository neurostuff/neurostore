import UploadIcon from '@mui/icons-material/Upload';
import { Box, Button } from '@mui/material';
import CurateStudies from 'components/CurationBeta/CurateStudies';
import CurationListItems, { ICurationListItem } from 'components/CurationBeta/CurationListItems';
import useGetCurationImportSummary from 'hooks/projects/useGetCurationImportSummary';
import React, { useEffect, useState } from 'react';
import { defaultExclusionTags } from 'stores/ProjectStore/models';
import CurationLayout from './CurationLayout';

const CurationPRISMAIdentificationInterface: React.FC = (_props) => {
    const importSummary = useGetCurationImportSummary();
    const [selectedListItem, setSelectedListItem] = useState<string>();

    useEffect(() => {
        if (selectedListItem === undefined && importSummary.length > 0) {
            setSelectedListItem(importSummary[0].id);
        }
    }, [selectedListItem, importSummary]);

    const handleSelectListItem = (selectedListItemId: string) => {
        setSelectedListItem(selectedListItemId);
    };

    const listItems: ICurationListItem[] = [
        {
            id: 'import-header',
            type: 'header',
            label: 'Imports',
            number: undefined,
        },
        ...importSummary.map((anImport) => {
            return {
                id: anImport.id,
                type: 'listItem' as 'listItem' | 'header',
                label: anImport.name,
                number: anImport.numStudies,
            };
        }),
        {
            id: 'exclusion-header',
            type: 'header',
            label: 'Exclusion Reasons',
            number: undefined,
        },
        {
            id: defaultExclusionTags.duplicate.id,
            type: 'listItem',
            label: defaultExclusionTags.duplicate.label,
            number: 14,
        },
    ];

    return (
        <CurationLayout
            listItems={
                <CurationListItems
                    selectedListItemId={selectedListItem || ''}
                    onSelectListItem={handleSelectListItem}
                    listItems={listItems}
                />
            }
            mainInterface={<CurateStudies />}
            header={
                <Box sx={{ marginBottom: '25px', display: 'flex', justifyContent: 'flex-start' }}>
                    <Button endIcon={<UploadIcon />} variant="contained" disableElevation>
                        Import Studies
                    </Button>
                </Box>
            }
        />
    );
};

export default CurationPRISMAIdentificationInterface;
