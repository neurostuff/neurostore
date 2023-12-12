import { useAuth0 } from '@auth0/auth0-react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import ExclusionSelectorPopup from 'components/CurationComponents/SelectorPopups/ExclusionSelectorPopup/ExclusionSelectorPopup';
import { ITag } from 'hooks/projects/useGetProjects';
import {
    useAddTagToStub,
    usePromoteStub,
    useRemoveTagFromStub,
    useSetExclusionFromStub,
} from 'pages/Projects/ProjectPage/ProjectStore';
import {
    ENeurosynthTagIds,
    defaultInfoTags,
} from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import React, { useState } from 'react';

interface IEditableStubSummaryHeader {
    type: 'excluded' | 'included' | 'default';
    columnIndex: number;
    stub: ICurationStubStudy;
    onMoveToNextStub: () => void;
}

const EditableStubSummaryHeader: React.FC<IEditableStubSummaryHeader> = React.memo((props) => {
    const { isAuthenticated } = useAuth0();

    const [exclusionTagSelectorIsOpen, setExclusionTagSelectorIsOpen] = useState(false);

    const addTagToStub = useAddTagToStub();
    const removeTagFromStub = useRemoveTagFromStub();
    const promoteStub = usePromoteStub();

    const setExclusionForStub = useSetExclusionFromStub();

    const handleAddTag = (tag: ITag) => {
        if (props.stub) {
            addTagToStub(props.columnIndex, props.stub.id, tag);
        }
    };

    const handleRemoveTag = (tagId: string) => {
        if (props.stub?.id) removeTagFromStub(props.columnIndex, props.stub.id, tagId);
    };

    const handleRemoveExclusion = () => {
        if (props.stub?.id) setExclusionForStub(props.columnIndex, props.stub.id, null);
    };

    const handleAddExclusion = (exclusionTag: ITag) => {
        if (props.stub?.id) {
            setExclusionForStub(props.columnIndex, props.stub.id, exclusionTag);
            setExclusionTagSelectorIsOpen(false);
            props.onMoveToNextStub();
        }
    };

    const handlePromote = () => {
        if (props.stub.id) {
            promoteStub(props.columnIndex, props.stub.id);
            props.onMoveToNextStub();
        }
    };

    const handleSaveForLater = () => {
        handleAddTag(defaultInfoTags.needsReview);
        props.onMoveToNextStub();
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
                        <CloseIcon />
                    </IconButton>
                </Box>
            );
            break;
        case 'included':
            categorizeHeader = (
                <Box>
                    <Typography sx={{ color: 'success.main' }} variant="h5" gutterBottom={false}>
                        Included
                    </Typography>
                </Box>
            );
            break;
        default:
            categorizeHeader = (
                <Box sx={{ display: 'flex', marginBottom: '8px' }}>
                    <Tooltip
                        placement="top"
                        title="Clicking this button will promote the study to the next column"
                    >
                        {/* have to use fragments, otherwise we get a forwardref error */}
                        <>
                            <LoadingButton
                                text="promote"
                                onClick={handlePromote}
                                variant="outlined"
                                disabled={!isAuthenticated}
                                color="success"
                                sx={{ marginRight: '10px', width: '160px' }}
                                startIcon={<CheckCircleOutlineIcon />}
                            />
                        </>
                    </Tooltip>
                    <LoadingButton
                        onClick={handleSaveForLater}
                        text="Needs Review"
                        startIcon={<HelpOutlineIcon />}
                        variant="outlined"
                        color="warning"
                        loaderColor="warning"
                        sx={{
                            borderColor: 'warning.dark',
                            color: 'warning.dark',
                            marginRight: '10px',
                            width: '160px',
                        }}
                        disabled={
                            !isAuthenticated ||
                            !!props.stub.tags.find(
                                (x) => x.id === ENeurosynthTagIds.NEEDS_REVIEW_TAG_ID
                            )
                        }
                    />
                    <ExclusionSelectorPopup
                        popupIsOpen={exclusionTagSelectorIsOpen}
                        onOpenPopup={() => setExclusionTagSelectorIsOpen(true)}
                        onClosePopup={() => setExclusionTagSelectorIsOpen(false)}
                        onAddExclusion={handleAddExclusion}
                        onCreateExclusion={handleAddExclusion}
                        disabled={!isAuthenticated}
                        columnIndex={props.columnIndex}
                    />
                </Box>
            );
            break;
    }

    return (
        <Box sx={{ minWidth: '700px' }}>
            <Box sx={{ display: 'flex' }}>
                <Box>{categorizeHeader}</Box>
                {/* <Box sx={{ marginLeft: 'auto' }}>
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
                                onAddTag={(tag) => handleAddTag(tag)}
                                onCreateTag={(tag) => handleAddTag(tag)}
                            />
                        </Box>
                    </NeurosynthPopper>
                    <Button
                        disabled={!isAuthenticated}
                        startIcon={<StyleIcon />}
                        ref={addTagsRef}
                        onClick={() => setTagSelectorIsOpen(true)}
                        size="medium"
                        variant="outlined"
                    >
                        add tags
                    </Button>
                </Box> */}
            </Box>

            <Box>
                {(props.stub.tags || []).map((tag) => (
                    <Chip
                        key={tag.id}
                        sx={{ margin: '3px' }}
                        disabled={!isAuthenticated}
                        label={tag.label}
                        onDelete={tag.isAssignable ? undefined : () => handleRemoveTag(tag.id)}
                    />
                ))}
            </Box>
        </Box>
    );
});

export default EditableStubSummaryHeader;
