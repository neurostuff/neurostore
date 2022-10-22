import { Chip, Box, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { IDraggableItem, ITag } from 'components/AnnotationContainer/DraggableItem/DraggableItem';

interface IAnnotateStudyListItem {
    exclusion: ITag | undefined;
    tags: ITag[];
    selected: boolean;
    item: IDraggableItem;
    onSelect: (index: number) => void;
    index: number;
}

const AnnotateStudyListItem: React.FC<IAnnotateStudyListItem> = (props) => {
    const isDraft = props.item.isDraft || props.item.isDraft === undefined;
    const title = props.item?.title ? `${props.item?.title}` : '';

    return (
        <ListItem
            disablePadding
            divider
            selected={props.selected}
            sx={{
                width: '100%',
                whiteSpace: 'break-spaces',
                backgroundColor: props?.exclusion ? '#1ee9001a' : '',
            }}
        >
            <ListItemButton
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start' }}
                autoFocus={props.selected}
                onClick={() => props.onSelect(props.index)}
            >
                {isDraft && (
                    <Typography variant="caption" sx={{ color: 'muted.main', padding: 0 }}>
                        (stub)
                    </Typography>
                )}
                <ListItemText
                    sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipses',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        lineClamp: 1,
                        whiteSpace: 'break-spaces',
                    }}
                    primary={title}
                />
                {props?.exclusion && (
                    <Typography sx={{ color: 'error.dark' }} variant="body2">
                        {props.exclusion?.label}
                    </Typography>
                )}
                <Box>
                    {props.item.tags.map((tag) => (
                        <Chip
                            sx={{ maxWidth: '70px', marginRight: '3px', marginTop: '3px' }}
                            key={tag.id}
                            size="small"
                            label={tag.label}
                        />
                    ))}
                </Box>
            </ListItemButton>
        </ListItem>
    );
};

export default AnnotateStudyListItem;
