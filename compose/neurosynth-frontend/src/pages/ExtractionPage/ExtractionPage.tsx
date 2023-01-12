import { Box, Breadcrumbs, Typography, Link, Tabs, Tab } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudysetById } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';

const ExtractionPage: React.FC = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const {
        data: project,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);
    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isError: getStudysetIsError,
    } = useGetStudysetById(project?.provenance?.extractionMetadata?.studysetId);

    const [currentTab, setCurrentTab] = useState(0);

    return (
        <StateHandlerComponent
            isError={getProjectIsError || getStudysetIsError}
            isLoading={getProjectIsLoading || getStudysetIsLoading}
        >
            <Box>
                <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
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
                            {project?.name || ''}
                        </Link>
                        <Typography color="secondary" sx={{ fontSize: '1.5rem' }}>
                            Extraction
                        </Typography>
                    </Breadcrumbs>
                </Box>
                <Box>
                    <Typography variant="h5">{studyset?.name || ''}</Typography>
                    <Typography sx={{ color: 'muted.main' }} variant="body1">
                        {studyset?.description || ''}
                    </Typography>
                </Box>
                <Box>
                    <Tabs
                        onChange={(_event, newValue) => setCurrentTab(newValue)}
                        centered
                        value={currentTab}
                    >
                        <Tab value={0} tabIndex={0} label="uncategorized"></Tab>
                        <Tab value={1} tabIndex={1} label="saved for later"></Tab>
                        <Tab value={2} tabIndex={2} label="completed"></Tab>
                    </Tabs>
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};

export default ExtractionPage;
