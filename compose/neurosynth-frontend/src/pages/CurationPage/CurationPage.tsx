import { Box, Breadcrumbs, Button, Link, Typography } from '@mui/material';
import { useParams, NavLink } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import SchemaIcon from '@mui/icons-material/Schema';
import CurationBoard from 'components/CurationComponents/CurationBoard/CurationBoard';
import { useEffect, useState } from 'react';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import CreateStubStudyDialog from 'components/Dialogs/CreateStubStudyDialog/CreateStubStudyDialog';
import PubmedImportDialog from 'components/Dialogs/PubMedImportDialog/PubMedImportDialog';
import PrismaDialog from 'components/Dialogs/PrismaDialog/PrismaDialog';
import {
    useProjectName,
    useProjectCurationIsPrisma,
    useProjectId,
    useInitStore,
} from 'pages/Projects/ProjectPage/ProjectStore';

const CurationPage: React.FC = (props) => {
    const [createStudyDialogIsOpen, setCreateStudyDialogIsOpen] = useState(false);
    const [pubmedImportDialogIsOpen, setPubMedImportDialogIsOpen] = useState(false);
    const [prismaIsOpen, setPrismaIsOpen] = useState(false);
    const { projectId }: { projectId: string | undefined } = useParams();

    const isPrisma = useProjectCurationIsPrisma();
    const projectName = useProjectName();
    const initStore = useInitStore();
    const storeProjectId = useProjectId();

    const [curationIsLoading, setCurationIsLoading] = useState(false);

    useEffect(() => {
        initStore(projectId);
    }, [initStore, projectId, storeProjectId]);

    useEffect(() => {
        function onStorageUpdate() {
            const isLoading = localStorage.getItem(`updateCurationIsLoading`) === 'true';
            if (isLoading) {
                window.onbeforeunload = () => {
                    return '';
                };
            } else {
                window.onbeforeunload = null;
            }
            setCurationIsLoading(isLoading);
        }
        window.addEventListener('storage', onStorageUpdate);
        return () => {
            window.removeEventListener('storage', onStorageUpdate);
        };
    }, []);

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
                                Curation
                            </Typography>
                        </Breadcrumbs>
                        {curationIsLoading && (
                            <Box sx={{ marginLeft: '2rem', display: 'flex' }}>
                                <Typography sx={{ color: 'muted.main', fontSize: '1.5rem' }}>
                                    updating...
                                </Typography>
                            </Box>
                        )}
                    </Box>
                    <Box sx={{ marginRight: '1rem' }}>
                        <PubmedImportDialog
                            onCloseDialog={() => setPubMedImportDialogIsOpen(false)}
                            isOpen={pubmedImportDialogIsOpen}
                        />
                        <Button
                            onClick={() => setPubMedImportDialogIsOpen(true)}
                            variant="outlined"
                            sx={{ marginRight: '1rem' }}
                            endIcon={<FileUploadIcon />}
                        >
                            import pubmed studies
                        </Button>
                        <CreateStubStudyDialog
                            onCloseDialog={() => setCreateStudyDialogIsOpen(false)}
                            isOpen={createStudyDialogIsOpen}
                        />
                        <Button
                            onClick={() => setCreateStudyDialogIsOpen(true)}
                            sx={{ marginRight: '1rem' }}
                            variant="outlined"
                            endIcon={<AddIcon />}
                        >
                            create study
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
                                    endIcon={<SchemaIcon />}
                                >
                                    PRISMA diagram
                                </Button>
                            </>
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
