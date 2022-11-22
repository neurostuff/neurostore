import { Box, Breadcrumbs, Button, Link, Typography } from '@mui/material';
import { useParams, NavLink } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import CurationBoard from 'components/CurationComponents/CurationBoard/CurationBoard';
import { useState } from 'react';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import CreateStubStudyDialog from 'components/Dialogs/CreateStubStudyDialog/CreateStubStudyDialog';
import PubmedImportDialog from 'components/Dialogs/PubMedImportDialog/PubMedImportDialog';

const CurationPage: React.FC = (props) => {
    const [createStudyDialogIsOpen, setCreateStudyDialogIsOpen] = useState(false);
    const [pubmedImportDialogIsOpen, setPubMedImportDialogIsOpen] = useState(false);
    const { projectId }: { projectId: string | undefined } = useParams();

    const { data } = useGetProjectById(projectId);

    return (
        <StateHandlerComponent isError={false} isLoading={false}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                }}
            >
                <Breadcrumbs sx={{ marginBottom: '0.5rem' }}>
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
                <Box>
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
            <CurationBoard />
        </StateHandlerComponent>
    );
};
export default CurationPage;
