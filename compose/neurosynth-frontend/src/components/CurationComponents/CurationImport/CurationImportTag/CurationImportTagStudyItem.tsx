import { Box, Link, Typography, Chip, Paper } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import TextExpansion from 'components/TextExpansion/TextExpansion';

const CurationImportTagStudyItem: React.FC<ICurationStubStudy & { style: React.CSSProperties }> = (
    props
) => {
    const {
        articleLink,
        articleYear,
        title,
        tags,
        authors,
        pmid,
        doi,
        abstractText,
        keywords,
        journal,
        style,
    } = props;

    return (
        <Box
            style={{
                ...style,
                ...{
                    borderRadius: '4px',
                    border: '1px solid #ebebeb',
                    height: '178px',
                    padding: '10px 10px',
                    marginBottom: '10px',
                    width: 'calc(100% - 30px)',
                },
            }}
        >
            {articleLink.length === 0 ? (
                <Typography color="primary" noWrap variant="h6">
                    {articleYear ? `(${articleYear})` : ''} {title}
                </Typography>
            ) : (
                <Link
                    rel="noopener"
                    underline="hover"
                    color="primary"
                    target="_blank"
                    href={articleLink}
                >
                    <Typography noWrap variant="h6">
                        {articleYear ? `(${articleYear})` : ''} {title}
                    </Typography>
                </Link>
            )}
            <Typography noWrap variant="body1">
                {authors}
            </Typography>
            <Typography noWrap variant="body1">
                {journal}
            </Typography>
            <Typography noWrap sx={{ fontWeight: 'bold' }}>
                {keywords}
            </Typography>
            <Box sx={{ display: 'flex' }}>
                <Box sx={{ marginRight: '2rem' }}>
                    <Typography variant="caption">PMID: </Typography>
                    <Typography variant="caption" sx={{ color: pmid ? 'initial' : 'warning.dark' }}>
                        {pmid || 'none'}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="caption">DOI: </Typography>
                    <Typography variant="caption" sx={{ color: doi ? 'initial' : 'warning.dark' }}>
                        {doi || 'none'}
                    </Typography>
                </Box>
            </Box>
            <Typography variant="body1" noWrap>
                {abstractText}
            </Typography>
            <Box sx={{ display: 'flex' }}>
                {tags.map((tag) => (
                    <Chip
                        sx={{
                            marginRight: '4px',
                            flex: 'auto 1 0px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                        size="small"
                        key={tag.id}
                        label={tag.label}
                    />
                ))}
            </Box>
        </Box>
    );
};

export default CurationImportTagStudyItem;
