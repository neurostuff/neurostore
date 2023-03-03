import { Box, Breadcrumbs, Link, Step, StepLabel, Stepper, Typography } from '@mui/material';
import CurationImportBase from 'components/CurationComponents/CurationImport/CurationImportBase';
import { useProjectId, useProjectName } from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

const CurationImportPage: React.FC = (props) => {
    const projectId = useProjectId();
    const projectName = useProjectName();

    const [activeStep, setActiveStep] = useState(0);

    return (
        <Box>
            <Box sx={{ display: 'flex' }}>
                <Breadcrumbs>
                    <Link
                        component={NavLink}
                        to="/projects"
                        sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                        underline="hover"
                    >
                        Projects
                    </Link>
                    <Link
                        component={NavLink}
                        to={`/projects/${projectId}`}
                        sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                        underline="hover"
                    >
                        {projectName || ''}
                    </Link>
                    <Link
                        component={NavLink}
                        to={`/projects/${projectId}/curation`}
                        sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                        underline="hover"
                    >
                        Search & Curate
                    </Link>
                    <Typography color="secondary" sx={{ fontSize: '1.5rem' }}>
                        Import
                    </Typography>
                </Breadcrumbs>
            </Box>
            <Box sx={{ marginTop: '1rem' }}>
                <CurationImportBase />
            </Box>
        </Box>
    );
};

export default CurationImportPage;
