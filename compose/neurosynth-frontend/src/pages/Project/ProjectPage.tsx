import { useAuth0 } from '@auth0/auth0-react';
import { Box, Chip, Tab, Tabs, Typography } from '@mui/material';
import LoadingStateIndicatorProject from 'components/LoadingStateIndicator/LoadingStateIndicatorProject';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import ProjectIsLoadingText from 'components/ProjectIsLoadingText';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import { useGuard } from 'hooks';
import useUserCanEdit from 'hooks/useUserCanEdit';
import ProjectComponentsEditPrivacyToggle from 'pages/Project/components/ProjectEditPrivacyToggle';
import {
    useGetProjectIsLoading,
    useProjectCreatedAt,
    useProjectDescription,
    useProjectIsError,
    useProjectMetaAnalysisCanEdit,
    useProjectName,
    useProjectUser,
    useProjectUsername,
    useUpdateProjectDescription,
    useUpdateProjectName,
} from 'pages/Project/store/ProjectStore';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

export interface IProjectPageLocationState {
    projectPage?: {
        openCurationDialog?: boolean;
        scrollToMetaAnalysisProceed?: boolean;
    };
}

const ProjectPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const { isAuthenticated } = useAuth0();
    const location = useLocation();
    const navigate = useNavigate();

    const updateProjectName = useUpdateProjectName();
    const updateProjectDescription = useUpdateProjectDescription();
    const metaAnalysesTabEnabled = useProjectMetaAnalysisCanEdit();
    const getProjectIsLoading = useGetProjectIsLoading();
    const projectName = useProjectName();
    const createdAt = useProjectCreatedAt();
    const projectUser = useProjectUser();
    const projectUserName = useProjectUsername();
    const projectDescription = useProjectDescription();
    const userCanEdit = useUserCanEdit(projectUser || undefined);
    const getProjectIsError = useProjectIsError();

    useGuard('/', 'No project found with id: ' + projectId, getProjectIsError, getProjectIsLoading);

    const tab = useMemo(() => {
        if (!metaAnalysesTabEnabled) return 0;
        return location.pathname.includes('meta-analyses') ? 1 : 0;
    }, [location.pathname, metaAnalysesTabEnabled]);

    return (
        <StateHandlerComponent isLoading={getProjectIsLoading} isError={getProjectIsError}>
            <Box sx={{ marginBottom: '5rem' }}>
                <Box sx={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
                    {isAuthenticated && (
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
                    )}
                    <LoadingStateIndicatorProject />
                </Box>

                <Box sx={{ marginBottom: '0.5rem' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Box sx={{ marginRight: '1rem', width: '100%' }}>
                            <TextEdit
                                onSave={(updatedName) => updateProjectName(updatedName)}
                                sx={{ width: '100%' }}
                                textFieldSx={{ input: { fontSize: '1.5rem' } }}
                                textToEdit={projectName || ''}
                                editIconIsVisible={userCanEdit}
                            >
                                <Typography
                                    sx={{
                                        color: projectName ? 'initial' : 'warning.dark',
                                        display: 'block',
                                    }}
                                    variant="h5"
                                >
                                    {projectName || 'No name'}
                                </Typography>
                            </TextEdit>
                        </Box>
                        <ProjectComponentsEditPrivacyToggle />
                    </Box>
                    <TextEdit
                        onSave={(updatedDescription) => updateProjectDescription(updatedDescription)}
                        textFieldSx={{ input: { fontSize: '1.25rem' } }}
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

                <Box sx={{ margin: '1.5rem 0' }}>
                    <Tabs
                        sx={{
                            '.MuiTabs-flexContainer': {
                                borderBottom: '1px solid lightgray',
                            },
                            '.MuiButtonBase-root.Mui-selected': {
                                backgroundColor: 'white',
                                border: '1px solid',
                                borderTopLeftRadius: '6px',
                                borderTopRightRadius: '6px',
                                borderColor: 'lightgray',
                                borderBottom: '0px',
                                marginBottom: '-2px',
                            },
                            '.MuibuttonBase-root': {},
                            transition: 'none',
                        }}
                        TabIndicatorProps={{
                            sx: {
                                display: 'none',
                            },
                        }}
                        value={tab}
                    >
                        <Tab
                            onClick={() => navigate(`/projects/${projectId}/project`)}
                            sx={{
                                color: tab === 0 ? '#ef8a24 !important' : 'primary.main',
                                fontWeight: tab === 0 ? 'bold' : 'normal',
                            }}
                            label="Project"
                        />
                        {metaAnalysesTabEnabled && (
                            <Tab
                                onClick={() => navigate(`/projects/${projectId}/meta-analyses`)}
                                sx={{
                                    color: tab === 1 ? '#ef8a24 !important' : 'primary.main',
                                    fontWeight: tab === 1 ? 'bold' : 'normal',
                                }}
                                label="Meta-Analyses"
                            />
                        )}
                    </Tabs>
                </Box>

                <Outlet />
            </Box>
        </StateHandlerComponent>
    );
};

export default ProjectPage;
