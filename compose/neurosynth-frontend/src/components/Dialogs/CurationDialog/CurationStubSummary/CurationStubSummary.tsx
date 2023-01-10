import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Typography, Box, Button, IconButton, Tooltip } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import NeurosynthConfirmationChip from 'components/NeurosynthConfirmationChip/NeurosynthConfirmationChip';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import React, { useRef, useState } from 'react';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import TagSelectorPopup from 'components/CurationComponents/TagSelectorPopup/TagSelectorPopup';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useParams } from 'react-router-dom';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { INeurosynthProject, ITag } from 'hooks/requests/useGetProjects';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import StyleIcon from '@mui/icons-material/Style';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';
import { MutateOptions } from 'react-query';
import { AxiosError, AxiosResponse } from 'axios';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import useUpdateCuration from 'hooks/requests/useUpdateCuration';

interface ICurationStubSummary {
    stub: ICurationStubStudy | undefined;
    columnIndex: number;
    onMoveToNextStub: () => void;
}

const CurationStubSummary: React.FC<ICurationStubSummary> = (props) => {
    const [exclusionTagSelectorIsOpen, setExclusionTagSelectorIsOpen] = useState(false);
    const [tagIdBeingUpdated, setTagIdBeingUpdated] = useState('');
    const [tagSelectorIsOpen, setTagSelectorIsOpen] = useState(false);
    const { projectId }: { projectId: string | undefined } = useParams();
    const {
        addExclusion,
        removeExclusion,
        addTag,
        removeTag,
        updateExclusionIsLoading,
        updateTagsIsLoading,
    } = useUpdateCuration(projectId);
    const {
        data,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);
    const { mutate: updateStubs, isLoading: updateStubsIsLoading } = useUpdateProject();
    const excludeButtonRef = useRef<HTMLButtonElement>(null);
    const addTagsRef = useRef<HTMLButtonElement>(null);

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

    const handleRemoveExclusion = () => {
        if (props.stub?.id) removeExclusion(props.columnIndex, props.stub.id);
    };

    const handleRemoveTag = (tagId: string) => {
        if (props.stub?.id) {
            setTagIdBeingUpdated(tagId);
            removeTag(props.columnIndex, props.stub.id, tagId);
        }
    };

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

    const handleSaveForLater = () => {
        if (projectId && data?.provenance?.curationMetadata?.tags && props.stub) {
            const saveForLaterTag = data.provenance.curationMetadata.tags.find(
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

    if (!props.stub) {
        return (
            <Box sx={{ padding: '2rem' }}>
                <Typography sx={{ color: 'warning.dark' }}>No study</Typography>
            </Box>
        );
    }

    if (getProjectIsError) {
        return (
            <Box>
                <Typography color="error">There was an error</Typography>
            </Box>
        );
    }

    const keywordString = (props.stub?.keywords || []).reduce(
        (prev, curr, index, arr) => `${prev}${curr}${index === arr.length - 1 ? '' : ', '}`,
        ''
    );

    const abstractElement =
        typeof props.stub.abstractText === 'string' ? (
            <Typography variant="body1">{props.stub.abstractText || ''}</Typography>
        ) : (
            <Box>
                {(props.stub.abstractText || []).map((abstractObj, index) => (
                    <Box key={index} sx={{ marginBottom: '0.5rem' }}>
                        <Typography sx={{ fontWeight: 'bold' }} variant="body1">
                            {abstractObj.label}
                        </Typography>
                        <Typography variant="body1">{abstractObj.text}</Typography>
                    </Box>
                ))}
            </Box>
        );

    const isLastColumn =
        (data?.provenance?.curationMetadata?.columns || []).length <= props.columnIndex + 1;

    let actionsHeader: JSX.Element;
    if (props.stub.exclusionTag) {
        actionsHeader = (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography sx={{ color: 'error.dark', fontWeight: 'bold' }} variant="h6">
                    {props.stub.exclusionTag.label}
                </Typography>
                <IconButton onClick={handleRemoveExclusion} sx={{ color: 'error.dark' }}>
                    {updateExclusionIsLoading ? <ProgressLoader size={24} /> : <CloseIcon />}
                </IconButton>
            </Box>
        );
    } else if (isLastColumn) {
        actionsHeader = (
            <Box>
                <Typography sx={{ color: 'success.main' }} variant="h5">
                    Included
                </Typography>
            </Box>
        );
    } else {
        actionsHeader = (
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
                            disabled={isLastColumn}
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
                        updateTagsIsLoading &&
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
                        ) || isLastColumn
                    }
                />
                <NeurosynthPopper
                    open={exclusionTagSelectorIsOpen}
                    anchorElement={excludeButtonRef?.current}
                    placement="bottom-start"
                    onClickAway={() => {
                        setExclusionTagSelectorIsOpen(false);
                    }}
                >
                    <Box sx={{ marginTop: '6px' }}>
                        <TagSelectorPopup
                            label="select exclusion reason"
                            isLoading={updateExclusionIsLoading}
                            isExclusion={true}
                            onAddTag={handleAddExclusion}
                        />
                    </Box>
                </NeurosynthPopper>
                <Button
                    startIcon={<HighlightOffIcon />}
                    ref={excludeButtonRef}
                    onClick={() => {
                        setExclusionTagSelectorIsOpen(true);
                    }}
                    size="medium"
                    color="error"
                    disabled={isLastColumn}
                    variant="outlined"
                >
                    exclude
                </Button>
            </>
        );
    }

    return (
        <Box sx={{ padding: '0rem 2rem' }}>
            <Box sx={{ display: 'flex', marginBottom: '0.5rem' }}>
                <Box sx={{ display: 'flex' }}>{actionsHeader}</Box>
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
                            isLoading={updateTagsIsLoading}
                            isExclusion={false}
                            onAddTag={(tag) =>
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
                    sx={{ marginLeft: '30px' }}
                    variant="outlined"
                >
                    add tags
                </Button>
                {props.stub.articleLink && (
                    <Button
                        href={props.stub.articleLink}
                        target="_blank"
                        sx={{ marginLeft: 'auto' }}
                        endIcon={<OpenInNewIcon />}
                        variant="text"
                    >
                        View article in PubMed
                    </Button>
                )}
            </Box>

            <Box sx={{ marginBottom: '6px' }}>
                {(props.stub.tags || []).map((tag) => (
                    <NeurosynthConfirmationChip
                        sx={{ margin: '3px' }}
                        key={tag.id}
                        isLoading={updateTagsIsLoading && tag.id === tagIdBeingUpdated}
                        onDelete={() => handleRemoveTag(tag.id)}
                        label={tag.label}
                    />
                ))}
            </Box>
            <Typography color="primary" variant="h5">
                {props.stub.title}
            </Typography>
            <Typography color="secondary" variant="h6">
                {props.stub.authors}
            </Typography>
            <Box sx={{ display: 'flex', color: 'secondary.main' }}>
                {props.stub?.pmid && (
                    <Typography variant="h6" sx={{ marginRight: '2rem' }}>
                        PMID: {props.stub.pmid}
                    </Typography>
                )}
                {props.stub?.doi && <Typography variant="h6">DOI: {props.stub.doi}</Typography>}
            </Box>
            <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                {keywordString}
            </Typography>
            {abstractElement}
        </Box>
    );
};

export default CurationStubSummary;
