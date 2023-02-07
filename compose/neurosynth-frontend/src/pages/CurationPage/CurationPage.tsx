import { Box, Breadcrumbs, Button, Link, Typography } from '@mui/material';
import { useParams, NavLink } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import SchemaIcon from '@mui/icons-material/Schema';
import CurationBoard from 'components/CurationComponents/CurationBoard/CurationBoard';
import { useState } from 'react';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import CreateStubStudyDialog from 'components/Dialogs/CreateStubStudyDialog/CreateStubStudyDialog';
import PubmedImportDialog from 'components/Dialogs/PubMedImportDialog/PubMedImportDialog';
import { useIsFetching, useIsMutating } from 'react-query';
import PrismaComponent from 'components/PrismaComponent/PrismaComponent';

const CurationPage: React.FC = (props) => {
    const [createStudyDialogIsOpen, setCreateStudyDialogIsOpen] = useState(false);
    const [pubmedImportDialogIsOpen, setPubMedImportDialogIsOpen] = useState(false);
    const isFetching = useIsFetching('projects');
    const { projectId }: { projectId: string | undefined } = useParams();
    const isMutating = useIsMutating([`projects`]);
    const { data, isLoading, isError } = useGetProjectById(projectId);

    return (
        <StateHandlerComponent isError={isError} isLoading={isLoading}>
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
                                {data?.name || ''}
                            </Link>
                            <Typography color="secondary" sx={{ fontSize: '1.5rem' }}>
                                Curation
                            </Typography>
                        </Breadcrumbs>
                        {isFetching + isMutating > 0 && (
                            <Box sx={{ marginLeft: '2rem', display: 'flex' }}>
                                <Typography sx={{ color: 'muted.main', fontSize: '1.5rem' }}>
                                    updating...
                                </Typography>
                            </Box>
                        )}
                    </Box>
                    <Box sx={{ marginRight: '1rem' }}>
                        <Button
                            sx={{ marginRight: '1rem' }}
                            variant="outlined"
                            endIcon={<SchemaIcon />}
                        >
                            PRISMA diagram
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
                        <PubmedImportDialog
                            onCloseDialog={() => setPubMedImportDialogIsOpen(false)}
                            isOpen={pubmedImportDialogIsOpen}
                        />
                        <Button
                            onClick={() => setPubMedImportDialogIsOpen(true)}
                            variant="outlined"
                            endIcon={<FileUploadIcon />}
                        >
                            import pubmed studies
                        </Button>
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
