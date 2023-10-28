import { Button, ButtonGroup, ListItem, ListItemButton, Menu } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useState } from 'react';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const EditStudySwapVersionButton: React.FC = (props) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
    const open = Boolean(anchorEl);

    const handleButtonPress = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseNavMenu = () => {
        setAnchorEl(null);
    };

    const handleSwapStudy = () => {};

    return (
        <>
            <Button
                sx={{ width: '280px', height: '36px' }}
                variant="contained"
                disableElevation
                color="secondary"
                onClick={handleButtonPress}
                startIcon={<SwapHorizIcon />}
            >
                Switch study version
            </Button>
            <Menu
                open={open}
                onClose={handleCloseNavMenu}
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <ListItem sx={{ padding: '0 1rem' }}>
                    <ButtonGroup variant="text">
                        <Button>
                            Version 238iERGtug | Owner: Neurosynth | Last Updated: Oct 28 2023
                        </Button>
                        <Button endIcon={<OpenInNewIcon />}>View </Button>
                    </ButtonGroup>
                </ListItem>
                <ListItem sx={{ padding: '0 1rem' }}>
                    <ButtonGroup variant="text">
                        <Button>
                            Version 238iERGtug | Owner: Neurosynth | Last Updated: Oct 28 2023
                        </Button>
                        <Button endIcon={<OpenInNewIcon />}>View </Button>
                    </ButtonGroup>
                </ListItem>
                <ListItem sx={{ padding: '0 1rem' }}>
                    <ButtonGroup variant="text">
                        <Button>
                            Version 238iERGtug | Owner: Neurosynth | Last Updated: Oct 28 2023
                        </Button>
                        <Button endIcon={<OpenInNewIcon />}>View </Button>
                    </ButtonGroup>
                </ListItem>
            </Menu>
        </>
    );
};

export default EditStudySwapVersionButton;
