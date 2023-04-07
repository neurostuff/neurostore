import { Box, Breadcrumbs, Button, Link, Typography } from '@mui/material';
import { useParams, NavLink, useHistory } from 'react-router-dom';
import SchemaIcon from '@mui/icons-material/Schema';
import CurationBoard from 'components/CurationComponents/CurationBoard/CurationBoard';
import { useEffect, useState } from 'react';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import PrismaDialog from 'components/Dialogs/PrismaDialog/PrismaDialog';
import {
    useProjectName,
    useProjectCurationIsPrisma,
    useInitProjectStore,
    useProjectExtractionStudysetId,
} from 'pages/Projects/ProjectPage/ProjectStore';
import CurationPageLoadingText from './CurationPageLoadingText';
import useGetCurationSummary from 'hooks/useGetCurationSummary';
import { IProjectPageLocationState } from 'pages/Projects/ProjectPage/ProjectPage';

const CurationPage: React.FC = (props) => {
    const [prismaIsOpen, setPrismaIsOpen] = useState(false);
    const { projectId }: { projectId: string | undefined } = useParams();
    const history = useHistory<IProjectPageLocationState>();

    const isPrisma = useProjectCurationIsPrisma();
    const studysetId = useProjectExtractionStudysetId();
    const projectName = useProjectName();
    const initProjectStore = useInitProjectStore();
    const { included, uncategorized } = useGetCurationSummary();

    useEffect(() => {
        initProjectStore(projectId);
    }, [initProjectStore, projectId]);

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
                            <Typography color="secondary" sx={{ fontSize: '1.5rem' }}>
                                Search & Curate
                            </Typography>
                        </Breadcrumbs>
                        <CurationPageLoadingText />
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
