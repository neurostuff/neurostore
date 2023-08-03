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
    useProjectExtractionStudysetId,
    useProjectName,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import ProjectIsLoadingText from 'pages/CurationPage/ProjectIsLoadingText';
import CurationBase from './CurationBase';

const CurationPageNew: React.FC = (props) => {
    const [prismaIsOpen, setPrismaIsOpen] = useState(false);
    const { projectId }: { projectId: string | undefined } = useParams();

    useInitProjectStoreIfRequired();

    const history = useHistory<IProjectPageLocationState>();

    const isPrisma = useProjectCurationIsPrisma();
    const studysetId = useProjectExtractionStudysetId();
    const projectName = useProjectName();
    const { included, uncategorized } = useGetCurationSummary();

    const handleMoveToExtractionPhase = () => {
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
                    <Box>
                        {/* <Button
                            variant="outlined"
                            sx={{ marginRight: '1rem' }}
                            onClick={() => history.push(`/projects/${projectId}/curation/import`)}
                        >
                            import studies
                        </Button> */}
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
                        {canMoveToExtractionPhase && (
                            <Button
                                onClick={handleMoveToExtractionPhase}
                                sx={{ marginLeft: '1rem' }}
                                variant="contained"
                                color="success"
                                disableElevation
                            >
                                Move To Extraction Phase
                            </Button>
                        )}
                    </Box>
                </Box>
                <Box>
                    <CurationBase />
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};
export default CurationPageNew;
