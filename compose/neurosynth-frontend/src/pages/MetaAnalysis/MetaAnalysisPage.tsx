import { Box, Button, Chip, Tooltip, Typography } from '@mui/material';
import PrivacyToggle from 'components/PrivacyToggle';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import { getLatestMetaAnalysisResultId } from 'helpers/MetaAnalysis.helpers';
import { useGetMetaAnalysisById, useGetMetaAnalysisResultById } from 'hooks';
import useUpdateMetaAnalysis from 'hooks/metaAnalyses/useUpdateMetaAnalysis';
import useUserCanEdit from 'hooks/useUserCanEdit';
import MetaAnalysisPageStyles from 'pages/MetaAnalysis/MetaAnalysisPage.styles';
import {
    useProjectIsPublic,
    useProjectName,
    useProjectUser,
    useInitProjectStoreIfRequired,
} from 'stores/projects/ProjectStore';
import { Link, useParams } from 'react-router-dom';
import MetaAnalysisDetails from './components/MetaAnalysisDetails';

const MetaAnalysisPage = () => {
    // const { startTour } = useGetTour('MetaAnalysisPage');
    const { projectId, metaAnalysisId } = useParams<{
        projectId: string;
        metaAnalysisId: string;
    }>();
    const {
        data: metaAnalysis,
        isError: getMetaAnalysisIsError,
        isLoading: getMetaAnalysisIsLoading,
    } = useGetMetaAnalysisById(metaAnalysisId);
    useInitProjectStoreIfRequired(projectId || metaAnalysis?.project || undefined);

    const projectUser = useProjectUser();
    const editsAllowed = useUserCanEdit(projectUser || undefined);
    const projectName = useProjectName();
    const projectIsPublic = useProjectIsPublic();

    /**
     * We need to use two separate instances of the same hook so that it only shows
     * the name loading when we update the name, and only the description loading when
     * we update the description
     */
    const { mutate: updateMetaAnalysisName, isPending: updateMetaAnalysisNameIsLoading } = useUpdateMetaAnalysis();

    const { mutate: updateMetaAnalysisDescription, isPending: updateMetaAnalysisDescriptionIsLoading } =
        useUpdateMetaAnalysis();

    const { mutate: updateMetaAnalysisPublic, isPending: updateMetaAnalysisPublicIsLoading } = useUpdateMetaAnalysis();

    const canEditMetaAnalysisPrivacy = useUserCanEdit(metaAnalysis?.user || undefined);
    const latestResultId = getLatestMetaAnalysisResultId(metaAnalysis);
    const { isLoading: getMetaAnalysisResultIsLoading } = useGetMetaAnalysisResultById(latestResultId);

    const updateName = (updatedName: string) => {
        if (metaAnalysis?.id) {
            updateMetaAnalysisName({
                metaAnalysisId: metaAnalysis.id,
                metaAnalysis: {
                    name: updatedName,
                },
            });
        }
    };

    const updateDescription = (updatedDescription: string) => {
        if (metaAnalysis?.id) {
            updateMetaAnalysisDescription({
                metaAnalysisId: metaAnalysis.id,
                metaAnalysis: {
                    description: updatedDescription,
                },
            });
        }
    };

    const updatePublic = (isPublic: boolean) => {
        if (!metaAnalysis?.id) return;
        updateMetaAnalysisPublic({
            metaAnalysisId: metaAnalysis.id,
            metaAnalysis: {
                public: isPublic,
            },
        });
    };

    const resolvedProjectId = projectId || metaAnalysis?.project || undefined;
    const isProjectRoute = Boolean(projectId);
    const breadcrumbItems = isProjectRoute
        ? [
              {
                  link: '/projects',
                  text: 'Projects',
                  isCurrentPage: false,
              },
              {
                  link: `/projects/${resolvedProjectId}/meta-analyses`,
                  text: projectName || '',
                  isCurrentPage: false,
              },
              {
                  link: '',
                  text: metaAnalysis?.name || '',
                  isCurrentPage: true,
              },
          ]
        : [
              {
                  link: '/meta-analyses',
                  text: 'Meta-Analyses',
                  isCurrentPage: false,
              },
              {
                  link: '',
                  text: metaAnalysis?.name || '',
                  isCurrentPage: true,
              },
          ];

    return (
        <>
            <StateHandlerComponent
                isLoading={getMetaAnalysisIsLoading || getMetaAnalysisResultIsLoading}
                isError={getMetaAnalysisIsError}
                errorMessage="There was an error getting your meta-analysis"
            >
                {!isProjectRoute && projectIsPublic && resolvedProjectId && (
                    <Tooltip title="View the project that generated this meta-analysis" placement="top">
                        <Button
                            component={Link}
                            sx={{ mb: 1 }}
                            variant="contained"
                            disableElevation
                            to={`/projects/${resolvedProjectId}`}
                            size="small"
                        >
                            View project
                        </Button>
                    </Tooltip>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <NeurosynthBreadcrumbs breadcrumbItems={breadcrumbItems} />

                    <Box sx={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PrivacyToggle
                            isPublic={metaAnalysis?.public ?? true}
                            canEdit={canEditMetaAnalysisPrivacy}
                            onChange={updatePublic}
                            isLoading={updateMetaAnalysisPublicIsLoading}
                            tooltipTitle="Toggle meta-analysis privacy"
                        />
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem', mt: 1 }}>
                    <TextEdit
                        editIconIsVisible={editsAllowed}
                        isLoading={updateMetaAnalysisNameIsLoading}
                        onSave={updateName}
                        textFieldSx={{ input: { fontSize: '1.5rem' } }}
                        label="name"
                        textToEdit={metaAnalysis?.name || ''}
                    >
                        <Box sx={MetaAnalysisPageStyles.displayedText}>
                            <Typography
                                sx={[
                                    MetaAnalysisPageStyles.displayedText,
                                    !metaAnalysis?.name ? MetaAnalysisPageStyles.noData : {},
                                ]}
                                variant="h5"
                            >
                                {metaAnalysis?.name || 'No name'}
                            </Typography>
                        </Box>
                    </TextEdit>

                    <TextEdit
                        editIconIsVisible={editsAllowed}
                        isLoading={updateMetaAnalysisDescriptionIsLoading}
                        onSave={updateDescription}
                        label="description"
                        textFieldSx={{ input: { fontSize: '1rem' } }}
                        textToEdit={metaAnalysis?.description || ''}
                    >
                        <Box sx={MetaAnalysisPageStyles.displayedText}>
                            <Typography
                                sx={[
                                    MetaAnalysisPageStyles.displayedText,
                                    MetaAnalysisPageStyles.description,
                                    !metaAnalysis?.description ? MetaAnalysisPageStyles.noData : {},
                                ]}
                            >
                                {metaAnalysis?.description || 'No description'}
                            </Typography>
                        </Box>
                    </TextEdit>
                    <Box>
                        {metaAnalysis?.username && (
                            <Chip
                                variant="filled"
                                size="small"
                                label={`Owner: ${metaAnalysis.username}`}
                                sx={{
                                    color: 'muted.dark',
                                    mt: '0.25rem',
                                }}
                            />
                        )}
                    </Box>
                </Box>

                <MetaAnalysisDetails />
            </StateHandlerComponent>
        </>
    );
};

export default MetaAnalysisPage;
