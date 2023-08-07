import SchemaIcon from '@mui/icons-material/Schema';
import { Box, Button } from '@mui/material';
import PrismaDialog from 'components/Dialogs/PrismaDialog/PrismaDialog';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetCurationSummary from 'hooks/useGetCurationSummary';
import ProjectIsLoadingText from 'pages/Projects/CurationPage/ProjectIsLoadingText';
import { IProjectPageLocationState } from 'pages/Projects/ProjectPage/ProjectPage';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
    useInitProjectStoreIfRequired,
    useProjectCurationIsPrisma,
    useProjectExtractionStudysetId,
    useProjectName,
} from 'stores/ProjectStore';
import CurationBase from 'components/CurationBeta/CurationBase';
import { useSnackbar } from 'notistack';

const CurationPage: React.FC = (props) => {
    const [prismaIsOpen, setPrismaIsOpen] = useState(false);
    const { projectId }: { projectId: string | undefined } = useParams();

    const history = useHistory<IProjectPageLocationState>();
    const { enqueueSnackbar } = useSnackbar();

    useInitProjectStoreIfRequired();
    const isPrisma = useProjectCurationIsPrisma();
    const studysetId = useProjectExtractionStudysetId();
    const projectName = useProjectName();
    const { included, uncategorized } = useGetCurationSummary();

    const handleMoveToExtractionPhase = () => {
        if (included === 0) {
            enqueueSnackbar('At least 1 study must be included to move to extraction phase', {
                variant: 'warning',
            });
            return;
        }

        if (uncategorized > 0) {
            enqueueSnackbar('All studies must be categorized to move to extraction phase', {
                variant: 'warning',
            });
            return;
        }

        if (studysetId) {
            history.push(`/projects/${projectId}/extraction`);
        } else {
            history.push(`/projects/${projectId}`, {
                projectPage: {
                    openCurationDialog: true,
                },
            });
        }
    };

    return (
        <StateHandlerComponent isError={false} isLoading={false}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box
                    sx={{
                        display: 'flex',
                        marginBottom: '1rem',
                        justifyContent: 'space-between',
                    }}
                >
                    <Box sx={{ display: 'flex' }}>
                        <NeurosynthBreadcrumbs
                            breadcrumbItems={[
                                {
                                    text: 'Projects',
                                    link: '/projects',
                                    isCurrentPage: false,
                                },
                                {
                                    text: projectName || '',
                                    link: `/projects/${projectId}`,
                                    isCurrentPage: false,
                                },
                                {
                                    text: 'Search & Curate',
                                    link: '',
                                    isCurrentPage: true,
                                },
                            ]}
                        />
                        <ProjectIsLoadingText />
                    </Box>
                    <Box>
                        {isPrisma && (
                            <>
                                <PrismaDialog
                                    onCloseDialog={() => setPrismaIsOpen(false)}
                                    isOpen={prismaIsOpen}
                                />
                                <Button
                                    onClick={() => setPrismaIsOpen(true)}
                                    variant="outlined"
                                    endIcon={<SchemaIcon />}
                                >
                                    PRISMA diagram
                                </Button>
                            </>
                        )}
                        <Button
                            onClick={handleMoveToExtractionPhase}
                            sx={{ marginLeft: '1rem' }}
                            variant="contained"
                            color="success"
                            disableElevation
                        >
                            Move To Extraction Phase
                        </Button>
                    </Box>
                </Box>
                <Box>
                    <CurationBase />
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};
export default CurationPage;
