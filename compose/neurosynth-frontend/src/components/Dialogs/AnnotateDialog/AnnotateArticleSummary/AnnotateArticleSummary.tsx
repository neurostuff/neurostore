import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { IDraggableItem } from 'components/AnnotationContainer/DraggableItem/DraggableItem';
import Chip from '@mui/material/Chip';
import Add from '@mui/icons-material/Add';
import { useRef, useState } from 'react';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import AddTagSelectorPopup from 'components/AnnotationContainer/DraggableItem/AddTagSelectorPopup.tsx/AddTagSelectorPopup';
import Typography from '@mui/material/Typography';

interface IAnnotateArticleSummary {
    item: IDraggableItem | undefined;
    onDeleteTag: (id: string) => void;
    onCreateTag: (itemId: string, tagName: string) => void;
    onAddTag: (itemId: string, tag: { id: string; label: string }) => void;
    tags: { id: string; label: string }[];
}

const AnnotateArticleSummary: React.FC<IAnnotateArticleSummary> = (props) => {
    const { item } = props;
    const anchorRef = useRef<HTMLButtonElement>(null);

    const [isOpen, setIsOpen] = useState(false);

    const authorString = item?.authors;

    const keywordString = (item?.keywords || []).reduce(
        (prev, curr, index, arr) => `${prev}${curr}${index === arr.length - 1 ? '' : ', '}`,
        ''
    );

    const handleAddTag = (tag: { label: string; id: string }) => {
        if (props.item) {
            setIsOpen(false);
            props.onAddTag(props.item.id, tag);
        }
    };

    const handleCreateTag = (tagName: string) => {
        if (props.item) {
            setIsOpen(false);
            props.onCreateTag(props.item.id, tagName);
        }
    };

    const handleDeleteTag = (id: string | undefined) => {
        if (id) {
            setIsOpen(false);
            props.onDeleteTag(id);
        }
    };

    return (
        <Box sx={{ overflowY: 'scroll', padding: '0 1.5rem', height: '100%' }}>
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
                <Box>
                    {props?.item?.tag ? (
                        <Chip
                            variant="filled"
                            color="error"
                            label={props?.item?.tag?.label || ''}
                            onDelete={(event: any) => handleDeleteTag(props?.item?.id)}
                        ></Chip>
                    ) : (
                        <>
                            <NeurosynthPopper
                                open={isOpen}
                                anchorElement={anchorRef.current}
                                onClickAway={() => setIsOpen(false)}
                            >
                                <AddTagSelectorPopup
                                    tags={props.tags}
                                    onAddTag={handleAddTag}
                                    onCreateTag={handleCreateTag}
                                />
                            </NeurosynthPopper>
                            <Button
                                ref={anchorRef}
                                onClick={() => {
                                    setIsOpen(true);
                                }}
                                startIcon={<Add />}
                                size="large"
                                color="error"
                            >
                                exclusion
                            </Button>
                        </>
                    )}
                </Box>
                {item?.articleLink && (
                    <Button
                        href={item?.articleLink}
                        target="_blank"
                        endIcon={<OpenInNewIcon />}
                        variant="outlined"
                    >
                        View article in PubMed
                    </Button>
                )}
            </Box>
            <Typography color="primary" sx={{ marginBottom: '0.5rem' }} variant="h4">
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
                <Typography variant="h6" sx={{ marginRight: '2rem' }}>
                    PMID: {item?.pmid}
                </Typography>
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
