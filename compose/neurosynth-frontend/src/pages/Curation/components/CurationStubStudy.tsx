import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { useProjectCurationIsLastColumn, useProjectExclusionTag } from 'pages/Project/store/ProjectStore';
import React from 'react';
import CurationStubStudyStyles from 'pages/Curation/components/CurationStubStudy.styles';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

const CurationStubStudy: React.FC<
    ICurationStubStudy & {
        columnIndex: number;
    }
> = React.memo((props) => {
    const isLastColumn = useProjectCurationIsLastColumn(props.columnIndex);
    const exclusionTag = useProjectExclusionTag(props.exclusionTagId);

    return (
        <Box sx={{ width: 'calc(100% - 35px)' }}>
            <Typography
                variant="body2"
                sx={{
                    fontWeight: props.exclusionTagId ? 'bold' : undefined,
                    marginBottom: '0',
                    color: isLastColumn ? 'success.main' : props.exclusionTagId ? 'error.dark' : 'warning.main',
                }}
            >
                {isLastColumn ? 'included' : props.exclusionTagId ? exclusionTag?.label : 'uncategorized'}
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
            <Box>
                <Typography noWrap>{props.authors}</Typography>
            </Box>
            <Box>
                <Typography noWrap variant="body2">
                    {props.journal}
                </Typography>
            </Box>
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
