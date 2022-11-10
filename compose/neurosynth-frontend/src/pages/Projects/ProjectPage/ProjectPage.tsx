import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import TextEdit from 'components/TextEdit/TextEdit';
import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import CurationStep from 'components/ProjectComponents/CurationStep/CurationStep';
import ExtractionStep from 'components/ProjectComponents/ExtractionStep/ExtractionStep';
import FiltrationStep from 'components/ProjectComponents/FiltrationStep/FiltrationStep';
import AlgorithmStep from 'components/ProjectComponents/AlgorithmStep/AlgorithmStep';
import { Tabs, Tab, Divider } from '@mui/material';

const ProjectPage: React.FC = (props) => {
    const [activeStep, setActiveStep] = useState(0);

    const [extractionIsDisabled, setExtractionIsDisabled] = useState(true);
    const [filtrationIsDisabled, setFiltrationIsDisabled] = useState(true);
    const [algorithmIsDisabled, setAlgorithmIsDisabled] = useState(true);
    const [hasMetaAnalysis, setHasMetaAnalysis] = useState(false);
    const [tab, setTab] = useState(0);

    useEffect(() => {
        if (hasMetaAnalysis) {
            setTab(1);
        } else {
            setTab(0);
        }
    }, [hasMetaAnalysis]);

    const handleTabChange = (event: any, tab: number) => {
        setTab(tab);
    };

    return (
        <Box>
            <Box sx={{ marginBottom: '0.5rem' }}>
                <TextEdit
                    onSave={() => {}}
                    sx={{ fontSize: '2rem' }}
                    textToEdit="My new project demo"
                >
                    <Typography variant="h4">My new project demo</Typography>
                    <div style={{ position: 'absolute', right: 0 }}>
                        <Button onClick={() => setExtractionIsDisabled(false)}>
                            enable extraction (for demo purposes)
                        </Button>
                        <br />
                        <Button onClick={() => setFiltrationIsDisabled(false)}>
                            enable filtration (for demo purposes)
                        </Button>
                        <br />
                        <Button onClick={() => setAlgorithmIsDisabled(false)}>
                            enable algorithm (for demo purposes)
                        </Button>
                    </div>
                </TextEdit>
                <TextEdit
                    onSave={() => {}}
                    textToEdit="This is a demo of an MVP for a redesigned project centered meta-analysis
                        user flow"
                >
                    <Typography>
                        This is a demo of an MVP for a redesigned project centered meta-analysis
                        user flow
                    </Typography>
                </TextEdit>
            </Box>

            <Tabs onChange={handleTabChange} value={tab} sx={{ marginBottom: '2rem' }}>
                <Tab
                    value={0}
                    label="Build Meta-Analysis"
                    sx={{
                        fontSize: '1.25rem',
                        whiteSpace: 'nowrap',
                        ':hover': { color: 'secondary.main' },
                    }}
                />
                <Tab
                    value={1}
                    sx={{
                        display: hasMetaAnalysis ? 'inherit' : 'none',
                        fontSize: '1.25rem',
                        whiteSpace: 'nowrap',
                        ':hover': { color: 'secondary.main' },
                    }}
                    label="View Meta-Analysis"
                />
            </Tabs>

            <Stepper
                activeStep={activeStep}
                orientation="vertical"
                sx={{
                    '.MuiStepConnector-root': { marginLeft: '20px' },
                    display: tab === 0 ? 'initial' : 'none',
                }}
            >
                <CurationStep />
                <ExtractionStep disabled={extractionIsDisabled} />
                <FiltrationStep disabled={filtrationIsDisabled} />
                <AlgorithmStep
                    onRunMetaAnalysis={() => setHasMetaAnalysis(true)}
                    disabled={algorithmIsDisabled}
                />
            </Stepper>
            <Box sx={{ display: tab === 1 ? 'initial' : 'none' }}>
                <Typography variant="h5" sx={{ color: 'warning.dark' }}>
                    This page is TBD: Your meta-analysis will go here.
                </Typography>
                <Typography variant="h5" sx={{ color: 'warning.dark' }}>
                    Once you run the meta-analysis, this will be the default page when the user
                    opens this project.
                </Typography>
            </Box>
        </Box>
    );
};

export default ProjectPage;
