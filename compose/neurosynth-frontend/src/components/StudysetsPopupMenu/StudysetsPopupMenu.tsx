import Add from '@mui/icons-material/Add';
import AddCircle from '@mui/icons-material/AddCircle';
import {
    IconButton,
    MenuItem,
    Divider,
    Box,
    TextField,
    Button,
    MenuList,
    Typography,
} from '@mui/material';
import React, { ChangeEvent, useState, useRef } from 'react';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useCreateStudyset, useGetStudysets, useUpdateStudyset } from 'hooks';
import { StudyReturn, StudysetReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useAuth0 } from '@auth0/auth0-react';

export interface IStudysetsPopupMenu {
    study: StudyReturn;
    disabled?: boolean;
}

const StudysetsPopupMenu: React.FC<IStudysetsPopupMenu> = (props) => {
    const { enqueueSnackbar } = useSnackbar();
    const { user } = useAuth0();
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const {
        isLoading: getStudysetsIsLoading,
        isError: getStudysetsIsError,
        data: studysets,
    } = useGetStudysets(user?.sub);
    const {
        isLoading: createStudysetIsLoading,
        isError: _createStudysetIsError,
        mutate: createStudyet,
    } = useCreateStudyset();
    const {
        isLoading: _updateStudysetIsLoading,
        isError: _updateStudysetIsError,
        mutate: updateStudyset,
    } = useUpdateStudyset();
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

    const handleCreateStudyset = (name: string, description: string) => {
        createStudyet(
            {
                name,
                description,
            },
            {
                onSuccess: () => {
                    setStudysetDetails({
                        name: '',
                        description: '',
                    });
                    enqueueSnackbar(`Created new studyset: ${name}`, { variant: 'success' });
                },
                onError: () => {
                    setStudysetDetails({
                        name: '',
                        description: '',
                    });
                    enqueueSnackbar('There was an error creating the studyset', {
                        variant: 'error',
                    });
                },
            }
        );
    };

    const handleAddStudyToStudyset = (study: StudyReturn, selectedStudyset: StudysetReturn) => {
        if (study?.id && selectedStudyset?.id) {
            const updatedStudysetStudies = [...(selectedStudyset.studies || [])] as string[];
            updatedStudysetStudies.push(study.id as string);

            updateStudyset(
                {
                    studysetId: selectedStudyset.id,
                    studyset: {
                        studies: updatedStudysetStudies,
                    },
                },
                {
                    onSuccess: () => {
                        enqueueSnackbar(
                            `${study.name} added to ${
                                selectedStudyset.name || selectedStudyset.id
                            }`,
                            {
                                variant: 'success',
                            }
                        );
                    },
                    onError: () => {
                        enqueueSnackbar(
                            `There was an error adding this study to ${
                                selectedStudyset.name || selectedStudyset.id
                            }`,
                            { variant: 'error' }
                        );
                    },
                }
            );
            setOpen(false);
        }
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
            <IconButton disabled={!!props.disabled} onClick={handleOpenMenu} ref={anchorRef}>
                <AddCircle color={props.disabled ? 'disabled' : 'primary'} />
            </IconButton>

            <NeurosynthPopper
                open={open}
                onClickAway={handleClickClose}
                anchorElement={anchorRef.current}
            >
                <Box
                    onClick={(event) => event.stopPropagation()}
                    sx={{ padding: '6px 16px', cursor: 'default' }}
                >
                    <Typography variant="subtitle1" fontWeight="bold">
                        Add to a studyset
                    </Typography>
                </Box>
                <Box
                    onClick={(event) => event.stopPropagation()}
                    sx={{ padding: '10px 16px', cursor: 'default' }}
                >
                    <StateHandlerComponent
                        loadingText="getting studysets"
                        isLoading={getStudysetsIsLoading || createStudysetIsLoading}
                        isError={getStudysetsIsError || !props.study}
                    >
                        <>
                            {(studysets || []).length > 0 && <Divider />}
                            <MenuList sx={{ maxHeight: '300px', overflowY: 'scroll' }}>
                                {(studysets || []).map((studyset) => (
                                    <MenuItem
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleAddStudyToStudyset(props.study, studyset);
                                        }}
                                        key={studyset.id}
                                    >
                                        {studyset.name || studyset.id}
                                    </MenuItem>
                                ))}
                            </MenuList>
                            <Divider sx={{ margin: '0 !important' }} />
                            {inCreateMode ? (
                                <Box
                                    onClick={(event) => event.stopPropagation()}
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        cursor: 'default',
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
                                            handleCreateStudyset(
                                                studysetDetails.name,
                                                studysetDetails.description
                                            );
                                        }}
                                        disabled={studysetDetails.name.length === 0}
                                        sx={{ marginTop: '1rem', width: '100%' }}
                                    >
                                        Create
                                    </Button>
                                </Box>
                            ) : (
                                <MenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setInCreateMode(true);
                                    }}
                                >
                                    <Typography
                                        sx={{ display: 'flex', alignItems: 'center' }}
                                        variant="subtitle1"
                                    >
                                        <Add sx={{ marginRight: '5px' }} />
                                        Create new studyset
                                    </Typography>
                                </MenuItem>
                            )}
                        </>
                    </StateHandlerComponent>
                </Box>
            </NeurosynthPopper>
        </>
    );
};

export default StudysetsPopupMenu;
