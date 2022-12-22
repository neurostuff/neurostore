import { Draggable } from '@hello-pangea/dnd';
import Close from '@mui/icons-material/Close';
import { Box, Button, Chip, IconButton, Link, Paper, Tooltip, Typography } from '@mui/material';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { ITag } from 'hooks/requests/useGetProjects';
import { useRef, useState } from 'react';
import TagSelectorPopup from 'components/CurationComponents/TagSelectorPopup/TagSelectorPopup';
import CurationStubStudyStyles from './CurationStubStudy.styles';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { useParams } from 'react-router-dom';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';

export interface ICurationStubStudy {
    id: string;
    title: string;
    authors: string;
    keywords: string[];
    pmid: string;
    doi: string;
    articleYear: number | undefined;
    abstractText: string | { label: string; text: string }[];
    articleLink: string;
    exclusionTag?: ITag;
    tags: ITag[];
}

const CurationStubStudy: React.FC<
    ICurationStubStudy & {
        index: number;
        isVisible: boolean;
        columnIndex: number;
        onSelectStubStudy: (itemIndex: string) => void;
    }
> = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const [tagSelectorPopupIsOpen, setTagSelectorPopupIsOpen] = useState(false);
    const { mutate, isLoading: updateProjectIsLoading } = useUpdateProject();
    const { data } = useGetProjectById(projectId);
    const anchorRef = useRef<HTMLButtonElement>(null);

    const handleOnAddExclusionTag = (tag: ITag) => {
        if (
            projectId &&
            data?.provenance?.curationMetadata?.columns &&
            data?.provenance?.curationMetadata?.columns.length > 0
        ) {
            const updatedColumns = [...data.provenance.curationMetadata.columns];
            const updatedStubsForColumn = [...updatedColumns[props.columnIndex].stubStudies];
            updatedStubsForColumn[props.index] = {
                ...updatedStubsForColumn[props.index],
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
                        setTagSelectorPopupIsOpen(false);
                    },
                }
            );
        }
    };

    const handleRemoveExclusionTag = () => {
        if (
            projectId &&
            data?.provenance?.curationMetadata?.columns &&
            data?.provenance?.curationMetadata?.columns.length > 0
        ) {
            const updatedColumns = [...data.provenance.curationMetadata.columns];
            const updatedStubsForColumn = [...updatedColumns[props.columnIndex].stubStudies];
            updatedStubsForColumn[props.index] = {
                ...updatedStubsForColumn[props.index],
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

    return (
        <Draggable
            draggableId={props.id}
            index={props.index}
            isDragDisabled={props?.exclusionTag !== undefined}
        >
            {(provided) => (
                <Paper
                    elevation={1}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    ref={provided.innerRef}
                    sx={[
                        CurationStubStudyStyles.stubStudyContainer,
                        {
                            display: props.isVisible ? 'block' : 'none',
                        },
                    ]}
                >
                    <Box sx={CurationStubStudyStyles.exclusionContainer}>
                        {props.exclusionTag ? (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography
                                    variant="body2"
                                    sx={{ color: 'error.dark', fontWeight: 'bold' }}
                                >
                                    {props.exclusionTag.label}
                                </Typography>
                                <IconButton
                                    sx={{ padding: '2px' }}
                                    onClick={() => handleRemoveExclusionTag()}
                                >
                                    {updateProjectIsLoading ? (
                                        <ProgressLoader size={12} />
                                    ) : (
                                        <Close
                                            sx={{
                                                fontSize: '1rem',
                                                color: 'error.dark',
                                            }}
                                        />
                                    )}
                                </IconButton>
                            </Box>
                        ) : (
                            <>
                                <NeurosynthPopper
                                    open={tagSelectorPopupIsOpen}
                                    anchorElement={anchorRef.current}
                                    onClickAway={() => setTagSelectorPopupIsOpen(false)}
                                >
                                    <TagSelectorPopup
                                        isLoading={updateProjectIsLoading}
                                        onAddTag={handleOnAddExclusionTag}
                                        isExclusion={true}
                                        label="Add exclusion"
                                    />
                                </NeurosynthPopper>
                                <Button
                                    ref={anchorRef}
                                    onClick={() => {
                                        setTagSelectorPopupIsOpen(true);
                                    }}
                                    endIcon={<ArrowDropDownIcon />}
                                    size="small"
                                    sx={{
                                        // make down arrow closer to button text
                                        '.MuiButton-iconSizeSmall': {
                                            marginLeft: '2px',
                                        },
                                    }}
                                    color="error"
                                    disableElevation
                                >
                                    exclude
                                </Button>
                            </>
                        )}
                    </Box>
                    <Link
                        underline="hover"
                        sx={{ marginBottom: '0.25rem' }}
                        onClick={() => props.onSelectStubStudy(props.id)}
                        variant="body1"
                    >
                        <Typography noWrap>{props.title}</Typography>
                    </Link>
                    <Typography sx={CurationStubStudyStyles.limitText}>{props.authors}</Typography>
                    <Typography variant="caption">{props.articleYear}</Typography>
                    <Box sx={{ padding: '5px 0', overflow: 'auto' }}>
                        {props.tags.map((tag) => (
                            <Tooltip title={tag.label} key={tag.id}>
                                <Chip
                                    sx={CurationStubStudyStyles.tag}
                                    size="small"
                                    label={tag.label}
                                />
                            </Tooltip>
                        ))}
                    </Box>
                </Paper>
            )}
        </Draggable>
    );
};

export default CurationStubStudy;
