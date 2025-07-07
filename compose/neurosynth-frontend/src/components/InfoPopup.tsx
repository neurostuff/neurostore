import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Checkbox, FormControlLabel, Link, Typography } from '@mui/material';
import { useState } from 'react';
import BaseDialog from './Dialogs/BaseDialog';

const InfoPopup: React.FC = () => {
    const { user } = useAuth0();
    console.log(user);
    const localStorageKey = `${user?.sub || ''}-hide-info-popup`;
    const shouldHide = !!localStorage.getItem(localStorageKey);
    const [hide, setShouldHide] = useState(shouldHide);

    const [checked, setIsChecked] = useState(false);

    const handleCloseDialog = () => {
        if (checked) {
            window.localStorage.setItem(localStorageKey, 'true');
        }
        setShouldHide(true);
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
                <Typography mb={3}>
                    If needed, you can switch back to the old interface using the toggle on the top right.
                </Typography>
                <Typography>
                    To learn more, you can{' '}
                    <Link
                        underline="hover"
                        fontWeight="bold"
                        target="_blank"
                        href="https://neurostuff.github.io/compose-docs/blog/2025/6/20/ai-review"
                    >
                        checkout our recent blog post
                    </Link>
                </Typography>
                <Box sx={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                    <FormControlLabel
                        control={<Checkbox checked={checked} onChange={(e) => setIsChecked(e.target.checked)} />}
                        label="Don't show this again"
                    />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button fullWidth onClick={handleCloseDialog} variant="contained" color="primary" disableElevation>
                        Continue
                    </Button>
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default InfoPopup;
