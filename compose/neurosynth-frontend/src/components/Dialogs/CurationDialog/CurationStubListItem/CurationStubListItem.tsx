import { Box, Chip, ListItem, ListItemButton, Typography } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { ENeurosynthTagIds } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import React from 'react';

interface ICurationStubListItem {
    selected: boolean;
    stub: ICurationStubStudy;
    onSetSelectedStub: (stubId: string) => void;
    style: React.CSSProperties;
}

const CurationStubListItem: React.FC<ICurationStubListItem> = React.memo((props) => {
    const itemColor = props.stub.exclusionTag
        ? '#fff3f3'
        : props.stub.tags.some((x) => x.id === ENeurosynthTagIds.NEEDS_REVIEW_TAG_ID)
        ? '#fff0b8'
        : '';

    return (
        <ListItem
            style={{
                ...props.style,
                ...{
                    backgroundColor: itemColor,
                },
            }}
            disablePadding
            divider
        >
            <ListItemButton
                onClick={() => props.onSetSelectedStub(props.stub.id || '')}
                selected={props.selected}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'start',
                    height: '100%',
                    width: '280px',
                }}
            >
                {props.stub.exclusionTag && (
                    <Typography sx={{ color: 'error.dark', fontWeight: 'bold' }} variant="body2">
                        {props.stub.exclusionTag.label}
                    </Typography>
                )}
                <Box sx={{ width: '100%' }}>
                    <Typography noWrap variant="body1">
                        {props.stub.articleYear ? `(${props.stub.articleYear}). ` : ''}{' '}
                        {props.stub.title}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', width: '100%' }}>
                    {props.stub.tags.map((tag) => (
                        <Chip
                            key={tag.id}
                            label={tag.label}
                            size="small"
                            sx={{
                                margin: '3px',
                                marginRight: '4px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        />
                    ))}
                </Box>
            </ListItemButton>
        </ListItem>
    );
});

export default CurationStubListItem;
