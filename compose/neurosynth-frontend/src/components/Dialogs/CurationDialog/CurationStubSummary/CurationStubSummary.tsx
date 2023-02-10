import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Typography, Box, Button, IconButton, Tooltip, Link } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import NeurosynthConfirmationChip from 'components/NeurosynthConfirmationChip/NeurosynthConfirmationChip';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import React, { useRef, useState } from 'react';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import TagSelectorPopup from 'components/CurationComponents/SelectorPopups/TagSelectorPopup/TagSelectorPopup';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useParams } from 'react-router-dom';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { INeurosynthProject, ISource, ITag } from 'hooks/requests/useGetProjects';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import StyleIcon from '@mui/icons-material/Style';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';
import { MutateOptions, useQueryClient } from 'react-query';
import { AxiosError, AxiosResponse } from 'axios';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import useUpdateCuration from 'hooks/requests/useUpdateCuration';
import TextEdit from 'components/TextEdit/TextEdit';
import IdentificationSourcePopup from 'components/CurationComponents/SelectorPopups/SourcePopup/SourcePopup';
import ExclusionSelectorPopup from 'components/CurationComponents/SelectorPopups/ExclusionSelectorPopup/ExclusionSelectorPopup';

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
    const { addExclusion, removeExclusion, addTag, removeTag, updateField, ...loadingState } =
        useUpdateCuration(projectId);
    const {
        data,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);
    const { mutate: updateStubs, isLoading: updateStubsIsLoading } = useUpdateProject();
    const excludeButtonRef = useRef<HTMLButtonElement>(null);
    const addTagsRef = useRef<HTMLButtonElement>(null);
    const queryClient = useQueryClient();

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

    const handleUpdateStub = (updatedText: string | number | ISource, label: string) => {
        if (props.stub?.id)
            updateField(
                props.columnIndex,
                props.stub.id,
                label as keyof ICurationStubStudy,
                updatedText
            );
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
                    {loadingState.updateExclusionIsLoading ? (
                        <ProgressLoader size={24} />
                    ) : (
                        <CloseIcon />
                    )}
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
                        <ExclusionSelectorPopup
                            label="select exclusion reason"
                            isLoading={loadingState.updateExclusionIsLoading}
                            onAddExclusion={(exclusion) => handleAddExclusion(exclusion)}
                            onCreateExclusion={(exclusion) => handleAddExclusion(exclusion)}
                            columnIndex={props.columnIndex}
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
        <Box sx={{ padding: '0rem 2rem', minWidth: '585px' }}>
            <Box sx={{ display: 'flex', marginBottom: '0.5rem' }}>
                <Box sx={{ display: 'flex' }}>{actionsHeader}</Box>
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

            <Box sx={{ marginBottom: '6px' }}>
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

            <Box sx={{ margin: '0.5rem 0', marginTop: '1rem' }}>
                <IdentificationSourcePopup
                    isLoading={loadingState.updateidentificationSourceIsLoading}
                    onAddSource={(source) => handleUpdateStub(source, 'identificationSource')}
                    onCreateSource={(source) => handleUpdateStub(source, 'identificationSource')}
                    initialValue={props.stub.identificationSource}
                    size="small"
                />
            </Box>

            <TextEdit
                sx={{ input: { fontSize: '1.25rem' } }}
                onSave={handleUpdateStub}
                label="title"
                isLoading={loadingState.updatetitleIsLoading}
                textToEdit={props.stub.title}
            >
                {props.stub.articleLink ? (
                    <Link
                        rel="noopener"
                        underline="hover"
                        color="primary"
                        target="_blank"
                        href={props.stub.articleLink}
                    >
                        <Typography variant="h6">{props.stub.title}</Typography>
                    </Link>
                ) : (
                    <Typography color="primary" variant="h5">
                        {props.stub.title}
                    </Typography>
                )}
            </TextEdit>

            <TextEdit
                sx={{ width: '100%', input: { fontSize: '1.25rem' } }}
                onSave={handleUpdateStub}
                isLoading={loadingState.updateauthorsIsLoading}
                label="authors"
                textToEdit={props.stub.authors}
            >
                <Typography
                    sx={{ color: props.stub.authors ? 'secondary.main' : 'warning.dark' }}
                    variant="h6"
                >
                    {props.stub.authors || 'No Authors'}
                </Typography>
            </TextEdit>
            <Box sx={{ display: 'flex' }}>
                <TextEdit
                    sx={{
                        width: '350px',
                        input: { padding: 0, fontSize: '1.25rem' },
                    }}
                    isLoading={loadingState.updatejournalIsLoading}
                    label="journal"
                    textToEdit={props.stub.journal}
                    onSave={handleUpdateStub}
                >
                    <Typography
                        sx={{ color: props.stub.journal ? 'initial' : 'warning.dark' }}
                        variant="h6"
                    >
                        {props.stub.journal || 'No Journal'}
                    </Typography>
                </TextEdit>
            </Box>
            <Box sx={{ display: 'flex' }}>
                <TextEdit
                    sx={{
                        width: '350px',
                        input: { padding: 0, fontSize: '1.25rem' },
                    }}
                    isLoading={loadingState.updatearticleYearIsLoading}
                    label="year"
                    fieldName="articleYear"
                    textToEdit={props.stub.articleYear || ''}
                    onSave={handleUpdateStub}
                >
                    <Typography
                        sx={{ color: props.stub.articleYear ? 'initial' : 'warning.dark' }}
                        variant="h6"
                    >
                        {props.stub.articleYear || 'No Year'}
                    </Typography>
                </TextEdit>
            </Box>
            <Box sx={{ display: 'flex' }}>
                <Typography sx={{ marginRight: '10px' }} variant="h6">
                    PMID:
                </Typography>
                <TextEdit
                    sx={{ input: { padding: 0, fontSize: '1.25rem' } }}
                    textToEdit={props.stub.pmid}
                    label="pmid"
                    isLoading={loadingState.updatepmidIsLoading}
                    onSave={handleUpdateStub}
                >
                    <Typography
                        sx={{ color: props.stub.pmid ? 'initial' : 'warning.dark' }}
                        variant="h6"
                    >
                        {props.stub.pmid || 'No PMID'}
                    </Typography>
                </TextEdit>
            </Box>
            <Box sx={{ display: 'flex' }}>
                <Typography sx={{ marginRight: '10px' }} variant="h6">
                    DOI:
                </Typography>
                <TextEdit
                    sx={{ input: { padding: 0, fontSize: '1.25rem' } }}
                    onSave={handleUpdateStub}
                    label="doi"
                    isLoading={loadingState.updatedoiIsLoading}
                    textToEdit={props.stub.doi}
                >
                    <Typography
                        sx={{ color: props.stub.doi ? 'initial' : 'warning.dark' }}
                        variant="h6"
                    >
                        {props.stub.doi || 'No DOI'}
                    </Typography>
                </TextEdit>
            </Box>

            <TextEdit
                label="keywords"
                onSave={handleUpdateStub}
                isLoading={loadingState.updatekeywordsIsLoading}
                textToEdit={props.stub.keywords}
            >
                <Typography
                    sx={{
                        color: props.stub.keywords ? 'initial' : 'warning.dark',
                        fontWeight: props.stub.keywords ? 'bold' : 'initial',
                    }}
                >
                    {props.stub.keywords || 'No Keywords'}
                </Typography>
            </TextEdit>
            <TextEdit
                label="description"
                onSave={handleUpdateStub}
                fieldName="abstractText"
                textToEdit={props.stub.abstractText}
                isLoading={loadingState.updateabstractTextIsLoading}
                multiline
            >
                <Typography
                    sx={{
                        color: props.stub.abstractText ? 'initial' : 'warning.dark',
                    }}
                >
                    {props.stub.abstractText || 'No Abstract'}
                </Typography>
            </TextEdit>
        </Box>
    );
};

export default CurationStubSummary;
