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
import { IDraggableItem } from 'components/AnnotationContainer/DraggableItem/DraggableItem';
import { IPubmedArticle } from 'hooks/requests/useGetPubmedIDs';
import React, { useEffect, useState } from 'react';
import AnnotateArticleListItem from './AnnotateArticleSummary/AnnotateArticleListItem';
import AnnotateArticleSummary from './AnnotateArticleSummary/AnnotateArticleSummary';
import CloseIcon from '@mui/icons-material/Close';

interface IAnnotateDialog {
    items: IDraggableItem[];
    isOpen: boolean;
    onCloseDialog: () => void;
    tags: { label: string; id: string }[];
    onUpdateItems: (items: IDraggableItem[]) => void;
    onCreateTag: (tag: string) => { label: string; id: string };
    selectedItemIndex?: number;
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

    const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);
    const selectedItem = items[selectedItemIndex];

    const handleUpdate = () => {
        props.onUpdateItems(items);
        props.onCloseDialog();
    };

    const handleAddTag = (
        itemId: string,
        tag: {
            id: string;
            label: string;
        }
    ) => {
        setItems((prev) => {
            const updatedItems = [...prev];
            const itemIndex = updatedItems.findIndex((x) => x.id === itemId);

            if (itemIndex < 0) return prev;

            updatedItems[itemIndex] = {
                ...updatedItems[itemIndex],
                tag: tag,
            };

            return updatedItems;
        });
    };

    const handleDeleteTag = (id: string) => {
        setItems((prev) => {
            const updatedList = [...prev];

            const itemIndex = updatedList.findIndex((x) => x.id === id);
            if (itemIndex < 0) return prev;

            updatedList[itemIndex] = {
                ...updatedList[itemIndex],
                tag: undefined,
            };

            return updatedList;
        });
    };

    const handleCreateTag = (itemId: string, tagName: string) => {
        const tag = props.onCreateTag(tagName);

        handleAddTag(itemId, tag);
    };

    return (
        <Dialog maxWidth="lg" open={props.isOpen} onClose={() => props.onCloseDialog()}>
            <DialogTitle
                sx={{
                    minWidth: '600px',
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
                    <Box sx={{ display: 'flex', marginBottom: '2rem', maxHeight: '500px' }}>
                        <Box sx={{ width: '30%', display: 'flex', flexDirection: 'column' }}>
                            <FormControl sx={{ width: '100%', marginTop: '2px' }}>
                                <OutlinedInput size="small" endAdornment={<SearchIcon />} />
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
                                            tag={article.tag}
                                            index={index}
                                            onSelect={(newIndex) => setSelectedItemIndex(newIndex)}
                                            item={article}
                                        />
                                    ))}
                                </List>
                            </Paper>
                        </Box>
                        <Box sx={{ width: '70%' }}>
                            <AnnotateArticleSummary
                                tags={props.tags}
                                onAddTag={handleAddTag}
                                onCreateTag={handleCreateTag}
                                onDeleteTag={handleDeleteTag}
                                item={selectedItem}
                            />
                        </Box>
                    </Box>
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                        <Button onClick={() => props.onCloseDialog()} color="error" variant="text">
                            close
                        </Button>
                        <Button variant="contained" onClick={() => handleUpdate()}>
                            save
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
