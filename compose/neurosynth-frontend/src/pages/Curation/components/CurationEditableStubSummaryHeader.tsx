import { useAuth0 } from '@auth0/auth0-react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Box, Chip, Tooltip } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import { ITag } from 'hooks/projects/useGetProjects';
import CurationPopupExclusionSelector from 'pages/Curation/components/CurationPopupExclusionSelector';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import {
    useAddTagToStub,
    useDemoteStub,
    usePromoteStub,
    useSetExclusionFromStub,
} from 'pages/Project/store/ProjectStore';
import { defaultInfoTags } from 'pages/Project/store/ProjectStore.types';
import React, { useState } from 'react';

interface ICurationEditableStubSummaryHeader {
    type: 'excluded' | 'included' | 'default';
    columnIndex: number;
    stub: ICurationStubStudy;
    onMoveToNextStub: () => void;
}

const CurationEditableStubSummaryHeader: React.FC<ICurationEditableStubSummaryHeader> = React.memo((props) => {
    const { isAuthenticated } = useAuth0();

    const [exclusionTagSelectorIsOpen, setExclusionTagSelectorIsOpen] = useState(false);

    const addTagToStub = useAddTagToStub();
    // const removeTagFromStub = useRemoveTagFromStub();
    const promoteStub = usePromoteStub();
    const demoteStub = useDemoteStub();

    const setExclusionForStub = useSetExclusionFromStub();

    const handleAddTag = (tag: ITag) => {
        if (props.stub) {
            addTagToStub(props.columnIndex, props.stub.id, tag);
        }
    };

    // const handleRemoveTag = (tagId: string) => {
    //     if (props.stub?.id) removeTagFromStub(props.columnIndex, props.stub.id, tagId);
    // };

    const handleRemoveExclusion = () => {
        if (props.stub?.id) setExclusionForStub(props.columnIndex, props.stub.id, null);
    };

    const handleDemoteStub = () => {
        if (!props.stub.id) return;
        demoteStub(props.columnIndex, props.stub.id);
        props.onMoveToNextStub();
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
                <Chip
                    sx={{ fontSize: '1.2rem', margin: '0.4rem 0', borderRadius: '4px' }}
                    onDelete={handleRemoveExclusion}
                    label={props.stub.exclusionTag?.label || 'Excluded'}
                    size="medium"
                    color="error"
                />
            );
            break;
        case 'included':
            categorizeHeader = (
                <Chip
                    sx={{ fontSize: '1.2rem', margin: '0.4rem 0', borderRadius: '4px' }}
                    onDelete={handleDemoteStub}
                    label="Included"
                    size="medium"
                    color="success"
                />
            );
            break;
        default:
            categorizeHeader = (
                <Box sx={{ display: 'flex', padding: '6px 0' }}>
                    <Tooltip placement="top" title="Clicking this button will promote the study to the next column">
                        {/* have to use fragments, otherwise we get a forwardref error */}
                        <>
                            <LoadingButton
                                text="include"
                                onClick={handlePromote}
                                variant="outlined"
                                disabled={!isAuthenticated}
                                color="success"
                                size="small"
                                sx={{ marginRight: '10px', width: '140px' }}
                                startIcon={<CheckCircleOutlineIcon />}
                            />
                        </>
                    </Tooltip>
                    {/* <LoadingButton
                        onClick={handleSaveForLater}
                        text="Needs Review"
                        startIcon={<HelpOutlineIcon />}
                        variant="outlined"
                        color="warning"
                        size="small"
                        loaderColor="warning"
                        sx={{
                            borderColor: 'warning.dark',
                            color: 'warning.dark',
                            marginRight: '10px',
                            width: '140px',
                        }}
                        disabled={
                            !isAuthenticated ||
                            !!props.stub.tags.find((x) => x.id === ENeurosynthTagIds.NEEDS_REVIEW_TAG_ID)
                        }
                    /> */}
                    <CurationPopupExclusionSelector
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
        <Box sx={{ paddingBottom: '4px' }}>
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
        </Box>
    );
});

export default CurationEditableStubSummaryHeader;
