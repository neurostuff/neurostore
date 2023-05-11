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
    FormControlLabel,
    Checkbox,
    LinearProgress,
} from '@mui/material';
import React, { ChangeEvent, useState, useRef } from 'react';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useCreateStudyset, useGetStudysets, useUpdateStudyset } from 'hooks';
import { StudyReturn, StudysetReturn } from 'neurostore-typescript-sdk';
import { useAuth0 } from '@auth0/auth0-react';
import { useIsFetching, useQueryClient } from 'react-query';

export interface IStudysetsPopupMenu {
    study: StudyReturn;
    disabled?: boolean;
}

const StudysetsPopupMenu: React.FC<IStudysetsPopupMenu> = (props) => {
    const queryClient = useQueryClient();
    const { user } = useAuth0();
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const {
        isLoading: getStudysetsIsLoading,
        isError: getStudysetsIsError,
        data: studysets,
    } = useGetStudysets({ userId: user?.sub });
    const { isLoading: createStudysetIsLoading, mutate: createStudyset } = useCreateStudyset();
    const { isLoading: updateStudysetIsLoading, mutate: updateStudyset } = useUpdateStudyset();
    const [inCreateMode, setInCreateMode] = useState(false);
    const [studysetDetails, setStudysetDetails] = useState({
        name: '',
        description: '',
    });
    const isFetching = useIsFetching('studies');

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
        createStudyset(
            {
                name,
                description,
            },
            {
                onSettled: () => {
                    setStudysetDetails({
                        name: '',
                        description: '',
                    });
                },
            }
        );
    };

    const handleUpdateStudyset = (
        study: StudyReturn,
        selectedStudyset: StudysetReturn,
        checked: boolean
    ) => {
        if (study?.id && selectedStudyset?.id) {
            const updatedStudysetStudies = checked
                ? [...((selectedStudyset.studies || []) as Array<string>), study.id] // if checked, add the study id
                : [
                      ...((selectedStudyset.studies || []) as Array<string>).filter(
                          (x) => x !== study.id
                      ),
                  ]; // if not checked, remove the study id

            updateStudyset(
                {
                    studysetId: selectedStudyset.id,
                    studyset: {
                        studies: updatedStudysetStudies,
                    },
                },
                {
                    onSuccess: () => {
                        queryClient.invalidateQueries('studies');
                    },
                }
            );
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

    const isLoading =
        getStudysetsIsLoading ||
        createStudysetIsLoading ||
        updateStudysetIsLoading ||
        isFetching > 0;

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
                        Add/Remove from studyset
                    </Typography>
                </Box>
                <Box
                    onClick={(event) => event.stopPropagation()}
                    sx={{ padding: '0px 16px 10px 16px', cursor: 'default' }}
                >
                    <StateHandlerComponent
                        loadingText="loading studysets"
                        isLoading={false}
                        isError={getStudysetsIsError || !props.study}
                    >
                        <>
                            <LinearProgress sx={{ visibility: isLoading ? 'visible' : 'hidden' }} />
                            <Divider />
                            <MenuList
                                sx={{
                                    maxHeight: '300px',
                                    overflowY: 'scroll',
                                    display:
                                        (studysets?.results?.length || 0) > 0 ? 'block' : 'none',
                                }}
                            >
                                {(studysets?.results || []).map((studyset) => (
                                    <MenuItem sx={{ padding: 0 }} key={studyset.id}>
                                        <FormControlLabel
                                            sx={{
                                                width: '100%',
                                                marginRight: 0,
                                                marginLeft: 0,
                                                paddingRight: '16px',
                                            }}
                                            control={
                                                <Checkbox
                                                    onChange={(event) => {
                                                        event.stopPropagation();
                                                        handleUpdateStudyset(
                                                            props.study,
                                                            studyset,
                                                            event.target.checked
                                                        );
                                                    }}
                                                    checked={props.study.studysets?.some(
                                                        (x) =>
                                                            (x.id || null) ===
                                                            (studyset.id || undefined)
                                                    )}
                                                />
                                            }
                                            label={studyset?.name || ''}
                                        />
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
                                    <Box sx={{ display: 'flex', width: '208px' }}>
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
                                        <Button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setInCreateMode(false);
                                            }}
                                            color="error"
                                            sx={{ marginTop: '1rem', width: '100%' }}
                                        >
                                            Cancel
                                        </Button>
                                    </Box>
                                </Box>
                            ) : (
                                <MenuItem
                                    sx={{ marginTop: '10px', width: '208px' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setInCreateMode(true);
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                        }}
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
