import SchemaIcon from '@mui/icons-material/Schema';
import { Box, Button } from '@mui/material';
import CurationBoard from 'components/CurationComponents/CurationBoard/CurationBoard';
import PrismaDialog from 'components/Dialogs/PrismaDialog/PrismaDialog';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetCurationSummary from 'hooks/useGetCurationSummary';
import { IProjectPageLocationState } from 'pages/Projects/ProjectPage/ProjectPage';
import {
    useInitProjectStoreIfRequired,
    useProjectCurationIsPrisma,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectName,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import ProjectIsLoadingText from './ProjectIsLoadingText';
import { useGetStudysetById } from 'hooks';

const CurationPage: React.FC = (props) => {
    const [prismaIsOpen, setPrismaIsOpen] = useState(false);
    const { projectId }: { projectId: string | undefined } = useParams();

    useInitProjectStoreIfRequired();

    const history = useHistory<IProjectPageLocationState>();

    const isPrisma = useProjectCurationIsPrisma();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const projectName = useProjectName();
    const { included, uncategorized } = useGetCurationSummary();
    const { data: studyset } = useGetStudysetById(studysetId || '', false);

    const handleMoveToExtractionPhase = () => {
        if (studysetId && annotationId && (studyset?.studies?.length || 0) > 0) {
            history.push(`/projects/${projectId}/extraction`);
        } else {
            history.push(`/projects/${projectId}`, {
                projectPage: {
                    openCurationDialog: true,
                },
            });
        }
    };

    const canMoveToExtractionPhase = included > 0 && uncategorized === 0;

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
                    <Box sx={{ marginRight: '1rem' }}>
                        <Button
                            variant="outlined"
                            sx={{ marginRight: '1rem' }}
                            onClick={() => history.push(`/projects/${projectId}/curation/import`)}
                        >
                            import studies
                        </Button>
                        {isPrisma && (
                            <>
                                <PrismaDialog
                                    onCloseDialog={() => setPrismaIsOpen(false)}
                                    isOpen={prismaIsOpen}
                                />
                                <Button
                                    onClick={() => setPrismaIsOpen(true)}
                                    variant="outlined"
                                    sx={{ marginRight: '1rem' }}
                                    endIcon={<SchemaIcon />}
                                >
                                    PRISMA diagram
                                </Button>
                            </>
                        )}
                        {canMoveToExtractionPhase && (
                            <Button
                                onClick={handleMoveToExtractionPhase}
                                variant="contained"
                                color="success"
                                disableElevation
                            >
                                Move To Extraction Phase
                            </Button>
                        )}
                    </Box>
                </Box>
                <Box sx={{ height: '100%', overflow: 'hidden' }}>
                    <CurationBoard />
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};
export default CurationPage;
