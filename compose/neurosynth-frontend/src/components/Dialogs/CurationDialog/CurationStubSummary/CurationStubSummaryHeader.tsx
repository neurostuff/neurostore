import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import CloseIcon from '@mui/icons-material/Close';
import StyleIcon from '@mui/icons-material/Style';
import useUpdateCurationStub from 'hooks/requests/useUpdateCurationStub';
import { useParams } from 'react-router-dom';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import ExclusionSelectorPopup from 'components/CurationComponents/SelectorPopups/ExclusionSelectorPopup/ExclusionSelectorPopup';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { INeurosynthProject, ITag } from 'hooks/requests/useGetProjects';
import { useRef, useState } from 'react';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import { AxiosError, AxiosResponse } from 'axios';
import { MutateOptions } from 'react-query';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import NeurosynthConfirmationChip from 'components/NeurosynthConfirmationChip/NeurosynthConfirmationChip';
import TagSelectorPopup from 'components/CurationComponents/SelectorPopups/TagSelectorPopup/TagSelectorPopup';

interface ICurationStubSummaryHeader {
    type: 'excluded' | 'included' | 'default';
    columnIndex: number;
    stub: ICurationStubStudy;
    onMoveToNextStub: () => void;
}

const CurationStubSummaryHeader: React.FC<ICurationStubSummaryHeader> = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const { removeExclusion, addExclusion, addTag, removeTag, ...loadingState } =
        useUpdateCurationStub(projectId);
    const { mutate: updateStubs, isLoading: updateStubsIsLoading } = useUpdateProject();
    const { data } = useGetProjectById(projectId);
    const addTagsRef = useRef<HTMLButtonElement>(null);

    const [exclusionTagSelectorIsOpen, setExclusionTagSelectorIsOpen] = useState(false);
    const [tagSelectorIsOpen, setTagSelectorIsOpen] = useState(false);
    const [tagIdBeingUpdated, setTagIdBeingUpdated] = useState('');

    const handleAddTag = (
        tag: ITag,
        options?: MutateOptions<
            AxiosResponse<ProjectReturn>,
            AxiosError<any>,
            {
                projectId: string;
                project: INeurosynthProject;
            }
        >
    ) => {
        if (props.stub) {
            setTagIdBeingUpdated(tag.id);
            addTag(props.columnIndex, props.stub, tag, options);
        }
    };

    const handleRemoveTag = (tagId: string) => {
        if (props.stub?.id) {
            setTagIdBeingUpdated(tagId);
            removeTag(props.columnIndex, props.stub.id, tagId);
        }
    };

    const handleRemoveExclusion = () => {
        if (props.stub?.id) removeExclusion(props.columnIndex, props.stub.id);
    };

    const handleAddExclusion = (exclusionTag: ITag) => {
        if (props.stub?.id) {
            addExclusion(props.columnIndex, props.stub.id, exclusionTag, {
                onSuccess: () => {
                    setExclusionTagSelectorIsOpen(false);
                    props.onMoveToNextStub();
                },
            });
        }
    };

    const handlePromote = () => {
        if (
            projectId &&
            props.stub &&
            data?.provenance?.curationMetadata?.columns &&
            data?.provenance?.curationMetadata?.columns.length > 0
        ) {
            const nextColumnExists =
                data.provenance.curationMetadata.columns[props.columnIndex + 1];
            const sourceIndex = data.provenance.curationMetadata.columns[
                props.columnIndex
            ].stubStudies.findIndex((x) => x.id === props.stub?.id);

            if (nextColumnExists && sourceIndex >= 0) {
                const startColIndex = props.columnIndex;
                const endColIndex = props.columnIndex + 1;

                const updatedColumns = [...data.provenance.curationMetadata.columns];

                const updatedStartColStubStudiesList = [
                    ...updatedColumns[startColIndex].stubStudies,
                ];

                const promotedStub = {
                    ...updatedStartColStubStudiesList[sourceIndex],
                };

                updatedStartColStubStudiesList.splice(sourceIndex, 1);
                const updatedStartCol = {
                    ...updatedColumns[startColIndex],
                    stubStudies: updatedStartColStubStudiesList,
                };

                const updatedEndColStubStudiesList = [...updatedColumns[endColIndex].stubStudies];
                updatedEndColStubStudiesList.splice(0, 0, promotedStub);
                const updatedEndCol = {
                    ...updatedColumns[endColIndex],
                    stubStudies: updatedEndColStubStudiesList,
                };

                updatedColumns[startColIndex] = updatedStartCol;
                updatedColumns[endColIndex] = updatedEndCol;

                updateStubs(
                    {
                        projectId: projectId,
                        project: {
                            provenance: {
                                ...data.provenance,
                                curationMetadata: {
                                    ...data.provenance.curationMetadata,
                                    columns: updatedColumns,
                                },
                            },
                        },
                    },
                    {
                        onSuccess: () => {
                            props.onMoveToNextStub();
                        },
                    }
                );
            }
        }
    };

    const handleSaveForLater = () => {
        if (projectId && data?.provenance?.curationMetadata?.infoTags && props.stub) {
            const saveForLaterTag = data.provenance.curationMetadata.infoTags.find(
                (x) => x.id === ENeurosynthTagIds.SAVE_FOR_LATER_TAG_ID
            );

            const saveForLaterTagExists = props.stub.tags.find(
                (x) => x.id === ENeurosynthTagIds.SAVE_FOR_LATER_TAG_ID
            );

            if (!saveForLaterTag || saveForLaterTagExists) return;

            handleAddTag(saveForLaterTag, {
                onSuccess: () => {
                    props.onMoveToNextStub();
                },
            });
        }
    };

    let categorizeHeader: JSX.Element;
    switch (props.type) {
        case 'excluded':
            categorizeHeader = (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography sx={{ color: 'error.dark', fontWeight: 'bold' }} variant="h6">
                        {props.stub.exclusionTag?.label || ''}
                    </Typography>
                    <IconButton onClick={handleRemoveExclusion} sx={{ color: 'error.dark' }}>
                        {loadingState.updateExclusionIsLoading ? (
                            <ProgressLoader size={24} />
                        ) : (
                            <CloseIcon />
                        )}
                    </IconButton>
                </Box>
            );
            break;
        case 'included':
            categorizeHeader = (
                <Box>
                    <Typography sx={{ color: 'success.main' }} variant="h5">
                        Included
                    </Typography>
                </Box>
            );
            break;
        default:
            categorizeHeader = (
                <>
                    <Tooltip
                        placement="top"
                        title="Clicking this button will promote the study to the next column"
                    >
                        {/* have to use fragments, otherwise we get a forwardref error */}
                        <>
                            <LoadingButton
                                text="promote"
                                isLoading={updateStubsIsLoading}
                                onClick={handlePromote}
                                variant="outlined"
                                color="success"
                                sx={{ marginRight: '10px', width: '124px' }}
                                startIcon={<CheckCircleOutlineIcon />}
                            />
                        </>
                    </Tooltip>
                    <LoadingButton
                        onClick={handleSaveForLater}
                        text="Save For Later"
                        startIcon={<HelpOutlineIcon />}
                        variant="outlined"
                        color="warning"
                        loaderColor="warning"
                        isLoading={
                            loadingState.updateTagsIsLoading &&
                            tagIdBeingUpdated === ENeurosynthTagIds.SAVE_FOR_LATER_TAG_ID
                        }
                        sx={{
                            borderColor: 'warning.dark',
                            color: 'warning.dark',
                            marginRight: '10px',
                            width: '169px',
                        }}
                        disabled={
                            !!props.stub.tags.find(
                                (x) => x.id === ENeurosynthTagIds.SAVE_FOR_LATER_TAG_ID
                            )
                        }
                    />
                    <ExclusionSelectorPopup
                        popupIsOpen={exclusionTagSelectorIsOpen}
                        onOpenPopup={() => setExclusionTagSelectorIsOpen(true)}
                        onClosePopup={() => setExclusionTagSelectorIsOpen(false)}
                        onAddExclusion={handleAddExclusion}
                        onCreateExclusion={handleAddExclusion}
                        columnIndex={props.columnIndex}
                        isLoading={loadingState.updateExclusionIsLoading}
                    />
                </>
            );
            break;
    }

    return (
        <Box sx={{ marginBottom: '0.5rem', minWidth: '700px' }}>
            <Box sx={{ display: 'flex' }}>
                <Box sx={{ display: 'flex' }}>{categorizeHeader}</Box>
                <Box sx={{ marginLeft: 'auto' }}>
                    <NeurosynthPopper
                        open={tagSelectorIsOpen}
                        anchorElement={addTagsRef?.current}
                        placement="bottom-start"
                        onClickAway={() => {
                            setTagSelectorIsOpen(false);
                        }}
                    >
                        <Box sx={{ marginTop: '6px' }}>
                            <TagSelectorPopup
                                label="select tag"
                                isLoading={loadingState.updateTagsIsLoading}
                                onAddTag={(tag) =>
                                    handleAddTag(tag, {
                                        onSuccess: () => {
                                            setTagSelectorIsOpen(false);
                                        },
                                    })
                                }
                                onCreateTag={(tag) =>
                                    handleAddTag(tag, {
                                        onSuccess: () => {
                                            setTagSelectorIsOpen(false);
                                        },
                                    })
                                }
                            />
                        </Box>
                    </NeurosynthPopper>
                    <Button
                        startIcon={<StyleIcon />}
                        ref={addTagsRef}
                        onClick={() => {
                            setTagSelectorIsOpen(true);
                        }}
                        size="medium"
                        variant="outlined"
                    >
                        add tags
                    </Button>
                </Box>
            </Box>

            <Box sx={{ margin: '6px 0' }}>
                {(props.stub.tags || []).map((tag) => (
                    <NeurosynthConfirmationChip
                        sx={{ margin: '3px' }}
                        key={tag.id}
                        isLoading={loadingState.updateTagsIsLoading && tag.id === tagIdBeingUpdated}
                        onDelete={() => handleRemoveTag(tag.id)}
                        label={tag.label}
                    />
                ))}
            </Box>
        </Box>
    );
};

export default CurationStubSummaryHeader;
