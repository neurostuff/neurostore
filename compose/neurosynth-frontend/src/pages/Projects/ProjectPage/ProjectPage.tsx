import { Box, Tab, Tabs, Typography } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import EditMetaAnalyses from 'components/ProjectComponents/EditMetaAnalyses/EditMetaAnalyses';
import ViewMetaAnalyses from 'components/ProjectComponents/ViewMetaAnalyses/ViewMetaAnalyses';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import useGetMetaAnalysesByProjectId from 'hooks/metaAnalyses/useGetMetaAnalysesByProjectId';
import ProjectIsLoadingText from 'pages/CurationPage/ProjectIsLoadingText';
import {
    useGetProjectIsLoading,
    useInitProjectStoreIfRequired,
    useProjectDescription,
    useProjectMetaAnalysisCanEdit,
    useProjectName,
    useUpdateProjectDescription,
    useUpdateProjectName,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect } from 'react';
import { Route, Switch, useHistory, useLocation, useParams } from 'react-router-dom';

export interface IProjectPageLocationState {
    projectPage?: {
        openCurationDialog?: boolean;
    };
}

// TODO: for now, we will only be supporting a single meta-analysis, so we only assume there is one. This will change later.
// const metaAnalysisId = (project?.meta_analyses as MetaAnalysis[]).
const ProjectPage: React.FC = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const { data: metaAnalyses } = useGetMetaAnalysesByProjectId(projectId || '');
    const location = useLocation();
    const history = useHistory();

    useInitProjectStoreIfRequired();

    const updateProjectName = useUpdateProjectName();
    const updateProjectDescription = useUpdateProjectDescription();
    const metaAnalysesTabEnabled = useProjectMetaAnalysisCanEdit();
    const getProjectIsLoading = useGetProjectIsLoading();
    const projectName = useProjectName();
    const projectDescription = useProjectDescription();

    // we only want this to run once on initial render
    useEffect(() => {
        metaAnalysesTabEnabled
            ? history.replace(`/projects/${projectId}/meta-analyses`)
            : history.replace(`/projects/${projectId}/edit`);
    }, [history, metaAnalyses, metaAnalysesTabEnabled, projectId]);

    const tab = location.pathname.includes('meta-analyses') ? 1 : 0;

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
                    <TextEdit
                        onSave={(updatedName, label) => updateProjectName(updatedName)}
                        sx={{ input: { fontSize: '2rem' }, width: '50%' }}
                        textToEdit={projectName || ''}
                    >
                        <Typography
                            sx={{ color: projectName ? 'initial' : 'warning.dark' }}
                            variant="h4"
                        >
                            {projectName || 'No name'}
                        </Typography>
                    </TextEdit>
                    <TextEdit
                        onSave={(updatedDescription, label) =>
                            updateProjectDescription(updatedDescription)
                        }
                        sx={{ input: { fontSize: '1.25rem' }, width: '50%' }}
                        textToEdit={projectDescription || ''}
                    >
                        <Typography
                            sx={{ color: projectDescription ? 'initial' : 'warning.dark' }}
                            variant="h6"
                        >
                            {projectDescription || 'No description'}
                        </Typography>
                    </TextEdit>
                </Box>

                <Box sx={{ borderBottom: 1, margin: '1rem 0 2rem 0', borderColor: 'divider' }}>
                    <Tabs
                        TabIndicatorProps={{
                            style: {
                                backgroundColor: '#ef8a24',
                            },
                        }}
                        value={tab}
                    >
                        <Tab
                            onClick={() => history.push(`/projects/${projectId}/edit`)}
                            sx={{
                                fontSize: '1.2rem',
                                color: tab === 0 ? '#ef8a24 !important' : 'primary.main',
                                fontWeight: tab === 0 ? 'bold' : 'normal',
                            }}
                            label="Edit Project"
                        />
                        <Tab
                            onClick={() => history.push(`/projects/${projectId}/meta-analyses`)}
                            disabled={!metaAnalysesTabEnabled}
                            sx={{
                                fontSize: '1.2rem',
                                color: tab === 1 ? '#ef8a24 !important' : 'primary.main',
                                fontWeight: tab === 1 ? 'bold' : 'normal',
                            }}
                            label="View Meta-Analyses"
                        />
                    </Tabs>
                </Box>

                <Switch>
                    <Route exact path={[`/projects/:projectId`, `/projects/:projectId/edit`]}>
                        <EditMetaAnalyses />
                    </Route>
                    <Route path={`/projects/:projectId/meta-analyses`}>
                        <ViewMetaAnalyses />
                    </Route>
                </Switch>
            </Box>
        </StateHandlerComponent>
    );
};

export default ProjectPage;
