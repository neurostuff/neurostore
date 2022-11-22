import { Draggable } from '@hello-pangea/dnd';
import Close from '@mui/icons-material/Close';
import { Box, Button, IconButton, Paper, Typography } from '@mui/material';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { ITag } from 'hooks/requests/useGetProjects';
import { useRef, useState } from 'react';
import TagSelectorPopup from 'components/CurationComponents/TagSelectorPopup/TagSelectorPopup';
import CurationStubStudyStyles from './CurationStubStudy.styles';

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

const CurationStubStudy: React.FC<ICurationStubStudy & { index: number; isVisible: boolean }> = (
    props
) => {
    const [tagSelectorPopupIsOpen, setTagSelectorPopupIsOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

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
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.25rem',
                        }}
                    >
                        {props.exclusionTag ? (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="body1" sx={{ color: 'error.dark' }}>
                                    {props.exclusionTag.label}
                                </Typography>
                                <IconButton onClick={() => {}}>
                                    <Close sx={{ fontSize: '1rem', color: 'error.dark' }} />
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
                                        label="Add exclusion"
                                        onAddTag={(tag) => {}}
                                        onCreateTag={(tagName) => {}}
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
                                >
                                    exclude
                                </Button>
                            </>
                        )}
                    </Box>
                </Paper>
            )}
        </Draggable>
    );
};

export default CurationStubStudy;
