import { Box, ListItem, ListItemButton, Typography } from '@mui/material';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { useProjectExclusionTag } from 'stores/projects/ProjectStore';
import { ENeurosynthTagIds } from 'stores/projects/ProjectStore.consts';
import React from 'react';

interface ICurationStubListItem {
    selected: boolean;
    stub: ICurationStubStudy;
    onSetSelectedStub: (stubId: string) => void;
    style: React.CSSProperties;
}

const CurationStubListItem = React.memo((props: ICurationStubListItem) => {
    const exclusionTag = useProjectExclusionTag(props.stub.exclusionTag);

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
                        {exclusionTag?.label}
                    </Typography>
                )}
                <Box sx={{ width: '100%' }}>
                    <Typography noWrap variant="body2">
                        {props.stub.articleYear ? `(${props.stub.articleYear}). ` : ''} {props.stub.title}
                    </Typography>
                    <Typography noWrap variant="body2" fontSize="12px">
                        {props.stub.authors}
                    </Typography>
                    <Typography noWrap variant="body2" fontSize="12px" color="gray">
                        {props.stub.journal}
                    </Typography>
                </Box>
            </ListItemButton>
        </ListItem>
    );
});

export default CurationStubListItem;
