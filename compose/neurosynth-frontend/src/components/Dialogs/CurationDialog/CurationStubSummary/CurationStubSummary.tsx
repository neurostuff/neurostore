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
import { ITag } from 'hooks/requests/useGetProjects';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import StyleIcon from '@mui/icons-material/Style';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';

interface ICurationStubSummary {
    stub: ICurationStubStudy | undefined;
    onMoveToNextItem: () => void;
    columnIndex: number;
}

const CurationStubSummary: React.FC<ICurationStubSummary> = (props) => {
    const [exclusionTagSelectorIsOpen, setExclusionTagSelectorIsOpen] = useState(false);
    const [tagSelectorIsOpen, setTagSelectorIsOpen] = useState(false);
    const { projectId }: { projectId: string | undefined } = useParams();
    const {
        data,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);
    const {
        mutate,
        isLoading: updateProjectIsLoading,
        isError: updateProjectIsError,
    } = useUpdateProject();
    const excludeButtonRef = useRef<HTMLButtonElement>(null);
    const addTagsRef = useRef<HTMLButtonElement>(null);

    const handleAddExclusion = (tag: ITag) => {
        if (
            projectId &&
            data?.provenance?.curationMetadata?.columns &&
            data?.provenance?.curationMetadata?.columns.length > 0
        ) {
            const updatedColumns = [...data.provenance.curationMetadata.columns];
            const updatedStubsForColumn = [...updatedColumns[props.columnIndex].stubStudies];

            const thisStubIndex = updatedStubsForColumn.findIndex((x) => x.id === props?.stub?.id);
            if (thisStubIndex < 0) return;

            updatedStubsForColumn[thisStubIndex] = {
                ...updatedStubsForColumn[thisStubIndex],
                exclusionTag: tag,
            };
            updatedColumns[props.columnIndex] = {
                ...updatedColumns[props.columnIndex],
                stubStudies: updatedStubsForColumn,
            };

            mutate(
                {
                    projectId,
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
                        setExclusionTagSelectorIsOpen(false);
                    },
                }
            );
        }
    };

    const handleRemoveExclusion = () => {
        if (
            projectId &&
            data?.provenance?.curationMetadata?.columns &&
            data?.provenance?.curationMetadata?.columns.length > 0
        ) {
            const updatedColumns = [...data.provenance.curationMetadata.columns];
            const updatedStubsForColumn = [...updatedColumns[props.columnIndex].stubStudies];

            const thisStubIndex = updatedStubsForColumn.findIndex((x) => x.id === props?.stub?.id);
            if (thisStubIndex < 0) return;

            updatedStubsForColumn[thisStubIndex] = {
                ...updatedStubsForColumn[thisStubIndex],
                exclusionTag: undefined,
            };
            updatedColumns[props.columnIndex] = {
                ...updatedColumns[props.columnIndex],
                stubStudies: updatedStubsForColumn,
            };

            mutate({
                projectId,
                project: {
                    provenance: {
                        ...data.provenance,
                        curationMetadata: {
                            ...data.provenance.curationMetadata,
                            columns: updatedColumns,
                        },
                    },
                },
            });
        }
    };

    const handleDelete = (id: string) => {};

    const handleAddTag = (tag: ITag) => {
        if (
            projectId &&
            props.stub &&
            data?.provenance?.curationMetadata?.columns &&
            data?.provenance?.curationMetadata?.columns.length > 0
        ) {
            const tagExists = props.stub.tags.find((x) => x.id === tag.id);
            if (tagExists) return;

            const updatedColumns = [...data.provenance.curationMetadata.columns];
            const updatedStubsForColumn = [...updatedColumns[props.columnIndex].stubStudies];

            const thisStubIndex = updatedStubsForColumn.findIndex((x) => x.id === props?.stub?.id);
            if (thisStubIndex < 0) return;

            updatedStubsForColumn[thisStubIndex] = {
                ...updatedStubsForColumn[thisStubIndex],
                tags: [...updatedStubsForColumn[thisStubIndex].tags, tag],
            };
            updatedColumns[props.columnIndex] = {
                ...updatedColumns[props.columnIndex],
                stubStudies: updatedStubsForColumn,
            };

            mutate(
                {
                    projectId,
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
                        setTagSelectorIsOpen(false);
                    },
                }
            );
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

            handleAddTag(saveForLaterTag);
        }
    };

    if (!props.stub) {
        return (
            <Box>
                <Typography sx={{ color: 'warning.dark' }}>No study</Typography>
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

    return (
        <Box sx={{ padding: '0rem 2rem' }}>
            <Box sx={{ display: 'flex', marginBottom: '0.5rem' }}>
                <Box sx={{ display: 'flex' }}>
                    {props.stub.exclusionTag ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography
                                sx={{ color: 'error.dark', fontWeight: 'bold' }}
                                variant="h6"
                            >
                                {props.stub.exclusionTag.label}
                            </Typography>
                            <IconButton
                                onClick={handleRemoveExclusion}
                                sx={{ color: 'error.dark' }}
                            >
                                {updateProjectIsLoading ? (
                                    <ProgressLoader size={24} />
                                ) : (
                                    <CloseIcon />
                                )}
                            </IconButton>
                        </Box>
                    ) : (
                        <>
                            <Tooltip
                                placement="top"
                                title="Clicking this button will promote the study to the next column"
                            >
                                {/* have to use fragments, otherwise we get a forwardref error */}
                                <>
                                    <LoadingButton
                                        text="promote"
                                        onClick={() => {}}
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
                                isLoading={updateProjectIsLoading}
                                color="warning"
                                loaderColor="warning"
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
                                        isLoading={updateProjectIsLoading}
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
                                variant="outlined"
                            >
                                exclude
                            </Button>
                        </>
                    )}
                </Box>
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
                            isLoading={updateProjectIsLoading}
                            isExclusion={false}
                            onAddTag={handleAddTag}
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
                        onDelete={() => handleDelete(tag.id)}
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
