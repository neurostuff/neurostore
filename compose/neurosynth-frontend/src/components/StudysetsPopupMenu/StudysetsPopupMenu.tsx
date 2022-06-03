import Add from '@mui/icons-material/Add';
import AddCircle from '@mui/icons-material/AddCircle';
import { IconButton, MenuItem, Divider, Box, TextField, Button, MenuList } from '@mui/material';
import React, { ChangeEvent, useState, useRef } from 'react';
import { NeurosynthLoader, NeurosynthPopper } from '..';
import { StudysetsApiResponse, StudyApiResponse } from '../../utils/api';

export interface IStudysetsPopupMenu {
    studysets: StudysetsApiResponse[] | undefined;
    study: StudyApiResponse;
    onCreateStudyset: (studysetName: string, studysetDescription: string) => void;
    onStudyAddedToStudyset: (
        study: StudyApiResponse,
        updatedStudyset: StudysetsApiResponse
    ) => void;
}

const StudysetsPopupMenu: React.FC<IStudysetsPopupMenu> = (props) => {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [inCreateMode, setInCreateMode] = useState(false);
    const [studysetDetails, setStudysetDetails] = useState({
        name: '',
        description: '',
    });

    const handleClickClose = (event: MouseEvent | TouchEvent) => {
        event.stopPropagation();
        handleClose();
    };

    const handleClose = () => {
        setInCreateMode(false);
        setStudysetDetails({
            name: '',
            description: '',
        });
        setOpen(false);
    };

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setOpen(true);
    };

    const handleStudysetDetailsChange = (
        event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
    ) => {
        setStudysetDetails((prevState) => ({
            ...prevState,
            [event.target.name]: event.target.value,
        }));
    };

    return (
        <>
            <IconButton onClick={handleOpenMenu} ref={anchorRef}>
                <AddCircle color="primary" />
            </IconButton>

            <NeurosynthPopper
                open={open}
                onClickAway={handleClickClose}
                anchorElement={anchorRef.current}
            >
                <MenuList sx={{ cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ padding: '6px 16px', fontSize: '1rem' }}>
                        <Box sx={{ fontWeight: 'bold', marginBottom: '8px' }}>
                            Add to a studyset...
                        </Box>
                    </Box>
                    <NeurosynthLoader loadingText="fetching studysets" loaded={!!props.studysets}>
                        {props.studysets && (
                            <>
                                {props.studysets.length > 0 && <Divider />}
                                <Box sx={{ maxHeight: '300px', overflowY: 'scroll' }}>
                                    {props.studysets.map((studyset) => (
                                        <MenuItem
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                props.onStudyAddedToStudyset(props.study, studyset);
                                                setOpen(false);
                                            }}
                                            key={studyset.id}
                                        >
                                            {studyset.name || studyset.id}
                                        </MenuItem>
                                    ))}
                                </Box>
                                <Divider sx={{ margin: '0 !important' }} />
                                {inCreateMode ? (
                                    <MenuItem
                                        onKeyDown={(e) => e.stopPropagation()}
                                        disableRipple
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            width: '100%',
                                        }}
                                    >
                                        <TextField
                                            name="name"
                                            onChange={handleStudysetDetailsChange}
                                            value={studysetDetails.name}
                                            sx={{ marginBottom: '0.5rem', width: '100%' }}
                                            label="Studyset name"
                                            variant="standard"
                                            id="studyset-name"
                                        />
                                        <TextField
                                            name="description"
                                            onChange={handleStudysetDetailsChange}
                                            value={studysetDetails.description}
                                            label="Studyset description"
                                            variant="standard"
                                            sx={{ width: '100%' }}
                                            id="studyset-description"
                                        />
                                        <Button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                props.onCreateStudyset(
                                                    studysetDetails.name,
                                                    studysetDetails.description
                                                );
                                                handleClose();
                                            }}
                                            disabled={studysetDetails.name.length === 0}
                                            sx={{ marginTop: '1rem', width: '100%' }}
                                        >
                                            Create
                                        </Button>
                                    </MenuItem>
                                ) : (
                                    <MenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setInCreateMode(true);
                                        }}
                                        sx={{ marginTop: '8px' }}
                                    >
                                        <Add sx={{ marginRight: '0.5rem' }} />
                                        Create new studyset
                                    </MenuItem>
                                )}
                            </>
                        )}
                    </NeurosynthLoader>
                </MenuList>
            </NeurosynthPopper>
        </>
    );
};

export default StudysetsPopupMenu;
