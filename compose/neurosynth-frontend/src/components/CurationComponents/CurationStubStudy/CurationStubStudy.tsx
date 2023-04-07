import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { useProjectCurationIsLastColumn } from 'pages/Projects/ProjectPage/ProjectStore';
import React from 'react';
import CurationStubStudyStyles from './CurationStubStudy.styles';
import { ICurationStubStudy } from './CurationStubStudyDraggableContainer';

const CurationStubStudy: React.FC<
    ICurationStubStudy & {
        columnIndex: number;
    }
> = React.memo((props) => {
    const isLastColumn = useProjectCurationIsLastColumn(props.columnIndex);

    return (
        <Box sx={{ width: 'calc(100% - 35px)' }}>
            <Typography
                variant="body2"
                sx={{
                    fontWeight: props.exclusionTag ? 'bold' : undefined,
                    marginBottom: '0',
                    color: isLastColumn
                        ? 'success.main'
                        : props.exclusionTag
                        ? 'error.dark'
                        : 'warning.main',
                }}
            >
                {isLastColumn
                    ? 'included'
                    : props.exclusionTag
                    ? props.exclusionTag.label
                    : 'uncategorized'}
            </Typography>
            <Box sx={{ display: 'flex' }}>
                {props.articleYear && (
                    <Typography sx={{ marginRight: '4px', fontWeight: 'bold' }} variant="body1">
                        ({props.articleYear})
                    </Typography>
                )}
                <Typography sx={{ fontWeight: 'bold' }} noWrap variant="body1">
                    {props.title}
                </Typography>
            </Box>
            <Typography noWrap>{props.authors}</Typography>
            <Typography noWrap variant="caption">
                {props.journal}
            </Typography>
            <Box sx={{ padding: '5px 0', display: 'flex' }}>
                {props.tags.map((tag) => (
                    <Tooltip title={tag.label} key={tag.id}>
                        <Chip sx={CurationStubStudyStyles.tag} size="small" label={tag.label} />
                    </Tooltip>
                ))}
            </Box>
        </Box>
    );
});

export default CurationStubStudy;
