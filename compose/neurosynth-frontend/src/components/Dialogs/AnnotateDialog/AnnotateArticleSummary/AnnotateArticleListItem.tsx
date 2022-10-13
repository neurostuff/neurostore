import { Chip, ListItem, ListItemButton, ListItemText } from '@mui/material';
import { IDraggableItem } from 'components/AnnotationContainer/DraggableItem/DraggableItem';

interface IAnnotateStudyListItem {
    tag: { label: string; id: string } | undefined;
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
            selected={props.selected}
            sx={{ width: '100%', whiteSpace: 'break-spaces' }}
        >
            <ListItemButton
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start' }}
                autoFocus={props.selected}
                onClick={() => props.onSelect(props.index)}
            >
                <ListItemText sx={{ color: 'muted.main' }} primary={'(draft)'} />
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
                {props?.item?.tag && (
                    <Chip
                        color="error"
                        variant="filled"
                        size="small"
                        label={props.item?.tag?.label || ''}
                    ></Chip>
                )}
            </ListItemButton>
        </ListItem>
    );
};

export default AnnotateStudyListItem;
