import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import { Box, Chip, Tab, Tabs, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import useUserCanEdit from 'hooks/useUserCanEdit';
import ProjectIsLoadingText from 'pages/CurationPage/ProjectIsLoadingText';
import {
    useGetProjectIsLoading,
    useInitProjectStoreIfRequired,
    useProjectCreatedAt,
    useProjectDescription,
    useProjectIsPublic,
    useProjectMetaAnalysisCanEdit,
    useProjectName,
    useProjectUser,
    useProjectUsername,
    useUpdateProjectDescription,
    useUpdateProjectIsPublic,
    useUpdateProjectName,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

export interface IProjectPageLocationState {
    projectPage?: {
        openCurationDialog?: boolean;
        scrollToMetaAnalysisProceed?: boolean;
    };
}

// TODO: for now, we will only be supporting a single meta-analysis, so we only assume there is one. This will change later.
// const metaAnalysisId = (project?.meta_analyses as MetaAnalysis[]).
const ProjectPage: React.FC = (props) => {
    const { projectId } = useParams<{ projectId: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    useInitProjectStoreIfRequired();

    const updateProjectName = useUpdateProjectName();
    const updateProjectDescription = useUpdateProjectDescription();
    const updateProjectIsPublic = useUpdateProjectIsPublic();
    const metaAnalysesTabEnabled = useProjectMetaAnalysisCanEdit();
    const getProjectIsLoading = useGetProjectIsLoading();
    const projectName = useProjectName();
    const createdAt = useProjectCreatedAt();
    const projectUser = useProjectUser();
    const projectUserName = useProjectUsername();
    const projectDescription = useProjectDescription();
    const isPublic = useProjectIsPublic();

    const userCanEdit = useUserCanEdit(projectUser || undefined);

    const tab = useMemo(
        () => (location.pathname.includes('meta-analyses') ? 1 : 0),
        [location.pathname]
    );

    return (
        <StateHandlerComponent isLoading={getProjectIsLoading} isError={false}>
            <Box sx={{ marginBottom: '5rem' }}>
                <Box sx={{ marginBottom: '0.5rem', display: 'flex' }}>
                    <NeurosynthBreadcrumbs
                        breadcrumbItems={[
                            {
                                text: 'Projects',
                                link: '/projects',
                                isCurrentPage: false,
                            },
                            {
                                text: projectName || '',
                                link: '',
                                isCurrentPage: true,
                            },
                        ]}
                    />
                    <ProjectIsLoadingText />
                </Box>

                <Box sx={{ marginBottom: '0.5rem' }}>
                    <Box sx={{ marginBottom: '0.5rem' }}>
                        <ToggleButtonGroup
                            exclusive
                            onChange={(event, newVal) => {
                                // do not update if newVal is the same as the current value or if it doesnt exist
                                if (newVal === null || newVal === isPublic) return;
                                updateProjectIsPublic(newVal === 'PUBLIC');
                            }}
                            color="primary"
                            value={isPublic ? 'PUBLIC' : 'PRIVATE'}
                            size="small"
                        >
                            <ToggleButton
                                value="PUBLIC"
                                sx={{ borderRadius: '8px', paddingLeft: '14px', height: '30px' }}
                            >
                                Public <PublicIcon sx={{ marginLeft: '10px', fontSize: '20px' }} />
                            </ToggleButton>
                            <ToggleButton
                                value="PRIVATE"
                                sx={{ borderRadius: '8px', paddingLeft: '14px', height: '30px' }}
                            >
                                Private <LockIcon sx={{ marginLeft: '10px', fontSize: '20px' }} />
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                    <Box>
                        <TextEdit
                            onSave={(updatedName, label) => updateProjectName(updatedName)}
                            sx={{ input: { fontSize: '1.5rem' } }}
                            textToEdit={projectName || ''}
                            editIconIsVisible={userCanEdit}
                        >
                            <Typography
                                sx={{ color: projectName ? 'initial' : 'warning.dark' }}
                                variant="h5"
                            >
                                {projectName || 'No name'}
                            </Typography>
                        </TextEdit>
                        <TextEdit
                            onSave={(updatedDescription, label) =>
                                updateProjectDescription(updatedDescription)
                            }
                            sx={{ input: { fontSize: '1.25rem' } }}
                            textToEdit={projectDescription || ''}
                            editIconIsVisible={userCanEdit}
                            multiline
                        >
                            <Typography
                                sx={{
                                    color: projectDescription ? 'muted.main' : 'warning.dark',
                                    whiteSpace: 'pre-line',
                                }}
                                variant="body1"
                            >
                                {projectDescription || 'No description'}
                            </Typography>
                        </TextEdit>
                        <Box
                            sx={{
                                marginTop: '0.2rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                            }}
                        >
                            <Box>
                                {projectUserName && (
                                    <Chip
                                        size="small"
                                        label={`Owner: ${projectUserName}`}
                                        variant="outlined"
                                        sx={{ marginRight: '0.5rem' }}
                                    />
                                )}
                                {createdAt && (
                                    <Chip
                                        size="small"
                                        label={`Created: ${
                                            createdAt.getMonth() + 1
                                        }/${createdAt.getDate()}/${createdAt.getFullYear()} ${createdAt.getHours()}:${createdAt.getMinutes()}`}
                                        variant="outlined"
                                    />
                                )}
                            </Box>
                        </Box>
                    </Box>
                </Box>

                <Box sx={{ borderBottom: 1, margin: '0.5rem 0 1rem 0', borderColor: 'divider' }}>
                    <Tabs
                        TabIndicatorProps={{
                            style: {
                                backgroundColor: '#ef8a24',
                            },
                        }}
                        value={tab}
                    >
                        <Tab
                            onClick={() => navigate(`/projects/${projectId}/project`)}
                            sx={{
                                fontSize: '1.2rem',
                                color: tab === 0 ? '#ef8a24 !important' : 'primary.main',
                                fontWeight: tab === 0 ? 'bold' : 'normal',
                            }}
                            label="Project"
                        />
                        <Tab
                            onClick={() => navigate(`/projects/${projectId}/meta-analyses`)}
                            disabled={!metaAnalysesTabEnabled}
                            sx={{
                                fontSize: '1.2rem',
                                color: tab === 1 ? '#ef8a24 !important' : 'primary.main',
                                fontWeight: tab === 1 ? 'bold' : 'normal',
                            }}
                            label="Meta-Analyses"
                        />
                    </Tabs>
                </Box>

                <Outlet />
            </Box>
        </StateHandlerComponent>
    );
};

export default ProjectPage;
