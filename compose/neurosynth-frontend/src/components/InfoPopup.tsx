import { Box, Button, Typography } from '@mui/material';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import BaseDialog from './Dialogs/BaseDialog';

const InfoPopup: React.FC = () => {
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const localStorageKey = `${projectId}-hide-info-popup`;
    const shouldHide = !!localStorage.getItem(localStorageKey);
    const [hide, setShouldHide] = useState(shouldHide);

    const handleCloseDialog = () => {
        setShouldHide(true);
        window.localStorage.setItem(localStorageKey, 'true');
    };

    return (
        <BaseDialog
            dialogTitle="Welcome to the new Curation interface!"
            isOpen={!hide}
            onCloseDialog={handleCloseDialog}
        >
            <Box>
                <Typography gutterBottom>
                    We've made some significant changes to make the UI more useful and intuitive.
                </Typography>
                <Typography gutterBottom>
                    We're also introducing <b>AI Assisted Curation</b>. This feature uses LLMs to extract key study
                    information (e.g. demographics, design & task details) from the full text of papers, making it
                    easier to screen studies for inclusion.
                </Typography>
                <Typography gutterBottom>To get started, import studies into curation.</Typography>
                <Typography>
                    In the <i>simple workflow</i>, AI-extracted information will be shown in the table, as well as
                    individual study pages.
                </Typography>
                <Typography>
                    For <i>PRISMA</i>, this feature is available after the Identification step.
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                    <Button fullWidth onClick={handleCloseDialog} variant="contained" color="primary" disableElevation>
                        Continue
                    </Button>
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default InfoPopup;
