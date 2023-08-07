import { Box, Button } from '@mui/material';
import CurationGroupListItems from './CurationGroupListItems';
import CurateStudies from './CurateStudies';
import UploadIcon from '@mui/icons-material/Upload';
import { useProjectCurationIsPrisma } from 'stores/ProjectStore';
import { EDefaultPRISMAStepNames } from 'components/ProjectComponents/EditMetaAnalyses/CurationStep/CurationStep';
import CurationPRISMAIdentification from './CurationPRISMAIdentification';
import { ICurationColumn } from 'interfaces/project/curation.interface';

const CurateInterface: React.FC<{ curationStep: ICurationColumn }> = (props) => {
    const isPRISMA = useProjectCurationIsPrisma();

    console.log(props.curationStep);
    if (isPRISMA && props.curationStep.name === EDefaultPRISMAStepNames.IDENTIFICATION) {
        return <CurationPRISMAIdentification />;
    } else {
        return <div>other</div>;
    }

    return (
        <Box sx={{ backgroundColor: 'rgb(242, 242, 242)', padding: '25px' }}>
            <Box sx={{ marginBottom: '25px', display: 'flex', justifyContent: 'flex-start' }}>
                <Button endIcon={<UploadIcon />} variant="contained" disableElevation>
                    Import Studies
                </Button>
            </Box>
            <Box
                sx={{
                    display: 'flex',
                }}
            >
                <Box sx={{ width: '250px' }}>
                    <CurationGroupListItems />
                </Box>
                <Box
                    sx={{
                        width: 'calc(100% - 250px)',
                        backgroundColor: 'rgb(244, 245, 247)',
                    }}
                >
                    <CurateStudies />
                </Box>
            </Box>
        </Box>
    );
};

export default CurateInterface;
