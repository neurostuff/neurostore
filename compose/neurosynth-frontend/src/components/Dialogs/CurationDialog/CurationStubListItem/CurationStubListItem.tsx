import { Box, Chip, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import CurationStubStudyStyles from 'components/CurationComponents/CurationStubStudy/CurationStubStudy.styles';
import React from 'react';

interface ICurationStubListItem {
    selected: boolean;
    stub: ICurationStubStudy;
    onSetSelectedStub: (stubId: string) => void;
}

const CurationStubListItem: React.FC<ICurationStubListItem> = React.memo((props) => {
    return (
        <ListItem
            sx={{ backgroundColor: props.stub.exclusionTag ? '#fff3f3' : '' }}
            disablePadding
            divider
        >
            <ListItemButton
                onClick={() => props.onSetSelectedStub(props.stub.id || '')}
                selected={props.selected}
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start' }}
                autoFocus={props.selected}
            >
                {props.stub.exclusionTag && (
                    <Typography sx={{ color: 'error.dark', fontWeight: 'bold' }} variant="body2">
                        {props.stub.exclusionTag.label}
                    </Typography>
                )}
                <ListItemText sx={CurationStubStudyStyles.limitText} primary={props.stub.title} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                    {props.stub.tags.map((tag) => (
                        <Chip
                            key={tag.id}
                            label={tag.label}
                            size="small"
                            sx={{ margin: '3px', maxWidth: '70px' }}
                        />
                    ))}
                </Box>
            </ListItemButton>
        </ListItem>
    );
});

export default CurationStubListItem;
