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
                <Typography mb={3}>
                    We've made some significant changes to make the UI more useful and intuitive.
                </Typography>
                <Typography mb={3}>
                    We're also introducing <b>AI Assisted Curation</b>. This feature uses LLMs to extract key study
                    information (e.g. demographics, design & task details) from the full text of papers, making it
                    easier to screen studies for inclusion.
                </Typography>
                <Typography>To get started, import studies into curation.</Typography>
                <Typography>
                    In the <i>simple workflow</i>, AI-extracted information will be shown in the table, as well as in
                    the individual study view.
                </Typography>
                <Typography mb={3}>
                    For <i>PRISMA</i>, this feature is available after the Identification step (also in the table and
                    individual study view).
                </Typography>
                <Typography>
                    If needed, you can switch back to the old interface using the toggle on the top right.
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
