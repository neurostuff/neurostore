import { Box, Button } from '@mui/material';
import CurationStepGroups from './CurationStepGroups';
import CurateStudies from './CurateStudies';

const CurationStepOverview: React.FC = (props) => {
    return (
        <Box sx={{ marginTop: '1rem', backgroundColor: 'rgb(242, 242, 242)', padding: '25px' }}>
            <Box sx={{ marginBottom: '25px', display: 'flex', justifyContent: 'flex-start' }}>
                <Button variant="contained" disableElevation>
                    Import Studies
                </Button>
                <Button
                    sx={{ marginLeft: '1rem' }}
                    color="info"
                    variant="contained"
                    disableElevation
                >
                    Promote all uncategorized studies
                </Button>
            </Box>
            <Box
                sx={{
                    display: 'flex',
                }}
            >
                <Box sx={{ width: '250px' }}>
                    <CurationStepGroups />
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

export default CurationStepOverview;
