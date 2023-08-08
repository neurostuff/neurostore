import { Box, Button } from '@mui/material';
import CurationListItems, { ICurationListItem } from 'components/CurationBeta/CurationListItems';
import UploadIcon from '@mui/icons-material/Upload';
import CurateStudies from 'components/CurationBeta/CurateStudies';
import { defaultExclusionTags, defaultIdentificationSources } from 'stores/ProjectStore.helpers';
import CurationLayout from './CurationLayout';
import { IImport } from 'interfaces/project/curation.interface';

const CurationPRISMAIdentificationInterface: React.FC = (props) => {
    const imports: (IImport & { numStudies: number })[] = [
        {
            id: 'a',
            name: 'WoS Import',
            source: defaultIdentificationSources.neurostore,
            numStudies: 43,
        },
        {
            id: 'b',
            name: 'RIS Import',
            source: defaultIdentificationSources.psycInfo,
            numStudies: 21,
        },
    ];

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
            number: anImport.numStudies,
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
};

export default CurationPRISMAIdentificationInterface;
