import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { IDraggableItem, ITag } from 'components/AnnotationContainer/DraggableItem/DraggableItem';
import Chip from '@mui/material/Chip';
import { useRef, useState } from 'react';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import AddTagSelectorPopup from 'components/AnnotationContainer/DraggableItem/AddTagSelectorPopup.tsx/AddTagSelectorPopup';
import Typography from '@mui/material/Typography';
// import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import StyleIcon from '@mui/icons-material/Style';
// import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import NeurosynthConfirmationChip from 'components/NeurosynthConfirmationChip/NeurosynthConfirmationChip';

interface IAnnotateArticleSummary {
    item: IDraggableItem | undefined;
    onCreateTag: (tagName: string, isExclusion: boolean) => ITag;
    onSetItem: (item: IDraggableItem) => void;
    onMoveToNextItem: () => void;
    exclusions: ITag[];
    allTags: ITag[];
    onInclude: (itemId: string) => void;
}

const AnnotateArticleSummary: React.FC<IAnnotateArticleSummary> = (props) => {
    const { item } = props;
    const excludeAnchorRef = useRef<HTMLButtonElement>(null);
    const addAnchorRef = useRef<HTMLButtonElement>(null);

    const [exclusionIsOpen, setExclusionIsOpen] = useState(false);
    const [tagsIsOpen, setTagsIsOpen] = useState(false);

    const authorString = item?.authors;

    const keywordString = (item?.keywords || []).reduce(
        (prev, curr, index, arr) => `${prev}${curr}${index === arr.length - 1 ? '' : ', '}`,
        ''
    );

    const handleSetExclusion = (tag: ITag) => {
        if (props.item) {
            const newItem = {
                ...props.item,
                exclusion: tag,
            };
            props.onSetItem(newItem);
            setExclusionIsOpen(false);
            props.onMoveToNextItem();
        }
    };

    const handleRemoveExclusion = (event: React.MouseEvent) => {
        if (props.item?.id) {
            const newItem = {
                ...props.item,
                exclusion: undefined,
            };
            props.onSetItem(newItem);
            setExclusionIsOpen(false);
        }
    };

    const handleCreateTag = (tagName: string, isExclusion: boolean) => {
        if (props.item) {
            const newTag = props.onCreateTag(tagName, isExclusion);
            handleAddTag(newTag);
        }
    };

    const handleAddTag = (tag: ITag) => {
        if (props.item) {
            const alreadyHasTag = props.item.tags.findIndex((x) => x.id === tag.id);
            if (alreadyHasTag >= 0) return;

            const newItem = {
                ...props.item,
                tags: [...(props.item.tags || []), tag],
            };
            props.onSetItem(newItem);
            setTagsIsOpen(false);
        }
    };

    const handleRemoveTag = (tag: ITag) => {
        if (props.item) {
            const updatedTags = props.item.tags.filter((x) => x.id !== tag.id);

            const newItem = {
                ...props.item,
                tags: [...updatedTags],
            };
            props.onSetItem(newItem);
        }
    };

    const handleInclude = () => {
        if (props.item) {
            props.onInclude(props.item.id);
        }
    };

    return (
        <Box sx={{ overflowY: 'auto', padding: '0 1.5rem', height: '100%' }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    position: 'sticky',
                    top: 0,
                    paddingTop: '5px',
                    paddingBottom: '0.75rem',
                    backgroundColor: 'white',
                }}
            >
                <Box sx={{ display: 'flex' }}>
                    {props?.item?.exclusion ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography sx={{ color: 'error.dark' }} variant="h6">
                                {props.item?.exclusion?.label}
                            </Typography>
                            <IconButton
                                onClick={handleRemoveExclusion}
                                sx={{ color: 'error.dark' }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    ) : (
                        <>
                            <NeurosynthPopper
                                open={exclusionIsOpen}
                                anchorElement={excludeAnchorRef.current}
                                placement="bottom-start"
                                onClickAway={() => {
                                    setExclusionIsOpen(false);
                                }}
                            >
                                {/* add space for label in mui auto correct component */}
                                <Box
                                    sx={{
                                        marginTop: '6px',
                                    }}
                                >
                                    <AddTagSelectorPopup
                                        tags={props.exclusions}
                                        onAddTag={handleSetExclusion}
                                        label="add exclusion"
                                        onCreateTag={(tagName) => handleCreateTag(tagName, true)}
                                    />
                                </Box>
                            </NeurosynthPopper>
                            <Tooltip
                                placement="top"
                                title="Clicking this button will promote the study to the right column"
                            >
                                <Button
                                    startIcon={<CheckCircleOutlineIcon />}
                                    size="medium"
                                    color="success"
                                    sx={{ marginRight: '15px' }}
                                    variant="outlined"
                                    onClick={handleInclude}
                                >
                                    include
                                </Button>
                            </Tooltip>
                            <Button
                                size="medium"
                                sx={{
                                    marginRight: '15px',
                                    color: 'warning.dark',
                                    borderColor: 'warning.dark',
                                }}
                                color="warning"
                                variant="outlined"
                                disabled={
                                    !!(props.item?.tags || []).find(
                                        (x) => x.label === 'Save study For Later'
                                    )
                                }
                                onClick={() => {
                                    const saveStudyLabel = 'Save study For Later';
                                    const studyHasSaveForLaterTag = (props.item?.tags || []).find(
                                        (x) => x.label === saveStudyLabel
                                    );

                                    if (!studyHasSaveForLaterTag) {
                                        const saveForLaterTag = props.allTags.find(
                                            (x) => x.label === saveStudyLabel
                                        );

                                        if (saveForLaterTag) {
                                            handleAddTag(saveForLaterTag);
                                            props.onMoveToNextItem();
                                        }
                                    }
                                }}
                                startIcon={<HelpOutlineIcon />}
                            >
                                Save For Later
                            </Button>
                            <Button
                                startIcon={<HighlightOffIcon />}
                                ref={excludeAnchorRef}
                                onClick={() => {
                                    setExclusionIsOpen(true);
                                }}
                                size="medium"
                                color="error"
                                variant="outlined"
                            >
                                exclude
                            </Button>
                        </>
                    )}
                    <NeurosynthPopper
                        open={tagsIsOpen}
                        anchorElement={addAnchorRef.current}
                        placement="bottom-start"
                        onClickAway={() => setTagsIsOpen(false)}
                    >
                        {/* add space for label in mui auto correct component */}
                        <Box
                            sx={{
                                marginTop: '6px',
                            }}
                        >
                            <AddTagSelectorPopup
                                tags={props.allTags}
                                onAddTag={handleAddTag}
                                onCreateTag={(tagName) => handleCreateTag(tagName, false)}
                            />
                        </Box>
                    </NeurosynthPopper>
                    <Button
                        ref={addAnchorRef}
                        sx={{ marginLeft: '45px' }}
                        onClick={() => setTagsIsOpen(true)}
                        size="medium"
                        startIcon={<StyleIcon />}
                    >
                        add tags
                    </Button>
                </Box>
                {item?.articleLink && (
                    <Button
                        href={item?.articleLink}
                        target="_blank"
                        endIcon={<OpenInNewIcon />}
                        variant="text"
                    >
                        View article in PubMed
                    </Button>
                )}
            </Box>
            <Box>
                <Box>
                    {(props.item?.tags || []).map((tag) => (
                        <NeurosynthConfirmationChip
                            key={tag.id}
                            size="small"
                            sx={{ marginRight: '5px', marginBottom: '5px' }}
                            label={tag.label}
                            onDelete={() => handleRemoveTag(tag)}
                        />
                    ))}
                </Box>
            </Box>
            <Typography color="primary" sx={{ marginBottom: '0.5rem' }} variant="h5">
                {item?.title || ''}{' '}
            </Typography>
            <Typography
                sx={{ marginBottom: '0.5rem', lineHeight: 'normal' }}
                color="secondary"
                variant="h6"
            >
                {authorString}
            </Typography>
            <Box sx={{ display: 'flex', marginBottom: '0.5rem', color: 'secondary.main' }}>
                {item?.pmid && (
                    <Typography variant="h6" sx={{ marginRight: '2rem' }}>
                        PMID: {item?.pmid}
                    </Typography>
                )}
                <Typography variant="h6">DOI: {item?.doi || ''}</Typography>
            </Box>
            <Typography sx={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
                {keywordString}
            </Typography>
            {typeof item?.abstractText === 'string' ? (
                <Typography variant="body1">{item?.abstractText || ''}</Typography>
            ) : (
                (item?.abstractText || []).map((x, index) => (
                    <Box key={index} sx={{ marginBottom: '0.5rem' }}>
                        <Typography sx={{ fontWeight: 'bold' }} variant="body1">
                            {x.label}
                        </Typography>
                        <Typography variant="body1">{x.text}</Typography>
                    </Box>
                ))
            )}
        </Box>
    );
};

export default AnnotateArticleSummary;
