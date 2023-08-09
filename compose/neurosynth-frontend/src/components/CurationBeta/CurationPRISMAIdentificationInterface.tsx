import UploadIcon from '@mui/icons-material/Upload';
import { Box, Button } from '@mui/material';
import CurateStudies from 'components/CurationBeta/CurateStudies';
import CurationListItems, { ICurationListItem } from 'components/CurationBeta/CurationListItems';
import { defaultExclusionTags } from 'stores/ProjectStore/models';
import CurationLayout from './CurationLayout';
import React from 'react';
import { useProjectCurationImports, useProjectCurationColumns } from 'stores/ProjectStore/getters';

const CurationPRISMAIdentificationInterface: React.FC = React.memo((_props) => {
    const imports = useProjectCurationImports();
    const columns = useProjectCurationColumns();
    console.log(columns);

    const listItems: ICurationListItem[] = [];
    listItems.push({
        id: 'import-header',
        type: 'header',
        label: 'Imports',
        number: undefined,
    });

    const mappedItems = imports.map((anImport) => {
        return {
            id: anImport.id,
            type: 'listItem' as 'listItem' | 'header',
            label: anImport.name,
            number: 3,
        };
    });

    listItems.push(...mappedItems);
    listItems.push({
        id: 'exclusion-header',
        type: 'header',
        label: 'Exclusion Reasons',
        number: undefined,
    });
    listItems.push({
        id: defaultExclusionTags.duplicate.id,
        type: 'listItem',
        label: defaultExclusionTags.duplicate.label,
        number: 14,
    });

    return (
        <CurationLayout
            listItems={<CurationListItems listItems={listItems} />}
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
});

export default CurationPRISMAIdentificationInterface;
