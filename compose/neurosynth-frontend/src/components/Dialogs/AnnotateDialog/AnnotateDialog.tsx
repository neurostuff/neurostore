import {
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    OutlinedInput,
    List,
    Paper,
    TextField,
    InputLabel,
    FormControl,
    Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { IDraggableItem, ITag } from 'components/AnnotationContainer/DraggableItem/DraggableItem';
import { IPubmedArticle } from 'hooks/requests/useGetPubmedIDs';
import React, { useEffect, useState } from 'react';
import AnnotateArticleListItem from './AnnotateArticleSummary/AnnotateArticleListItem';
import AnnotateArticleSummary from './AnnotateArticleSummary/AnnotateArticleSummary';
import CloseIcon from '@mui/icons-material/Close';

interface IAnnotateDialog {
    columnId: string;
    items: IDraggableItem[];
    isOpen: boolean;
    onCloseDialog: () => void;
    allExclusions: ITag[];
    allTags: ITag[];
    onCreateTag: (tag: string, isExclusion: boolean) => ITag;
    onSetItem: (columnId: string, item: IDraggableItem) => void;
    selectedItemIndex?: number;
    onInclude: (columnId: string, itemId: string) => void;
}

export type IPubmedArticleItem = IPubmedArticle & { included: boolean | undefined };

const AnnotateDialog: React.FC<IAnnotateDialog> = (props) => {
    const [items, setItems] = useState(props.items);

    useEffect(() => {
        if (props.items) {
            setItems(props.items);
        }
    }, [props.items]);

    useEffect(() => {
        if (props.selectedItemIndex) {
            setSelectedItemIndex(props.selectedItemIndex);
        } else {
            setSelectedItemIndex(0);
        }
    }, [props.selectedItemIndex]);

    const handleSetItem = (item: IDraggableItem) => {
        props.onSetItem(props.columnId, item);
    };

    const [selectedItemIndex, setSelectedItemIndex] = useState(0);
    const selectedItem = items[selectedItemIndex];

    const handleMoveToNextItem = () => {
        setSelectedItemIndex((prev) => (prev + 1 < items.length ? prev + 1 : prev));
    };

    return (
        <Dialog maxWidth="xl" open={props.isOpen} onClose={() => props.onCloseDialog()}>
            <DialogTitle
                sx={{
                    padding: '0px 2.5rem',
                    paddingTop: '1.5rem',
                    marginBottom: '1rem',
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ alignItems: 'center', display: 'flex' }}>
                        <Typography variant="h6">Categorize studies</Typography>
                    </Box>
                    <Box>
                        <IconButton onClick={() => props.onCloseDialog()}>
                            <CloseIcon sx={{ fontSize: '2rem' }} />
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>

            {items?.length > 0 ? (
                <DialogContent sx={{ padding: '0 2.5rem', paddingBottom: '2rem' }}>
                    <Box sx={{ display: 'flex', marginBottom: '2rem', maxHeight: '550px' }}>
                        <Box sx={{ width: '20%', display: 'flex', flexDirection: 'column' }}>
                            <FormControl sx={{ width: '100%', marginTop: '2px' }}>
                                <OutlinedInput
                                    size="small"
                                    endAdornment={<SearchIcon color="primary" />}
                                />
                            </FormControl>
                            <Divider sx={{ margin: '1rem 0' }} />
                            <Paper elevation={1} sx={{ overflowY: 'scroll', flexGrow: 1 }}>
                                <List sx={{ width: '100%' }}>
                                    {(items || []).map((article, index) => (
                                        <AnnotateArticleListItem
                                            selected={
                                                (selectedItem?.id || undefined) ===
                                                (article?.id || null)
                                            }
                                            key={index}
                                            exclusion={article.exclusion}
                                            tags={article.tags}
                                            index={index}
                                            onSelect={(newIndex) => setSelectedItemIndex(newIndex)}
                                            item={article}
                                        />
                                    ))}
                                </List>
                            </Paper>
                        </Box>
                        {/* if width is any smaller, it ruins display of elements in the summary page */}
                        <Box sx={{ width: '80%', minWidth: '565px' }}>
                            <AnnotateArticleSummary
                                onInclude={(itemId) => props.onInclude(props.columnId, itemId)}
                                exclusions={props.allExclusions}
                                allTags={props.allTags}
                                onCreateTag={props.onCreateTag}
                                onSetItem={handleSetItem}
                                item={selectedItem}
                                onMoveToNextItem={handleMoveToNextItem}
                            />
                        </Box>
                    </Box>
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            onClick={() => props.onCloseDialog()}
                            color="error"
                            variant="contained"
                        >
                            close
                        </Button>
                    </Box>
                </DialogContent>
            ) : (
                <Typography
                    sx={{ padding: '0 2.5rem', paddingBottom: '2.5rem' }}
                    color="warning.dark"
                >
                    No studies
                </Typography>
            )}
        </Dialog>
    );
};

export default AnnotateDialog;
