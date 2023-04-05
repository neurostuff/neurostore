import { Box, Typography, Chip, Button } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { PUBMED_ARTICLE_URL_PREFIX } from 'hooks/requests/useGetPubMedIds';

/**
 * Study summary for studies that are being imported and tagged. We cannot reuse the ReadOnlyStubSummary easily here because
 * all data needs to be a one liner with fixed height for virtualization purposes
 */
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
        exclusionTag,
        keywords,
        journal,
        neurostoreId,
        style,
    } = props;

    return (
        <Box
            style={{
                ...style,
                ...{
                    borderRadius: '4px',
                    border: exclusionTag ? '1px solid red' : '1px solid #ebebeb',
                    height: '208px',
                    padding: '10px 10px',
                    marginBottom: '10px',
                    width: 'calc(100% - 30px)',
                },
            }}
        >
            <Box>
                {neurostoreId && (
                    <Button
                        size="small"
                        variant="outlined"
                        rel="noopener"
                        target="_blank"
                        href={`/studies/${neurostoreId}`}
                        sx={{ marginRight: '15px' }}
                    >
                        view study in neurostore
                    </Button>
                )}
                {pmid && (
                    <Button
                        target="_blank"
                        href={`${PUBMED_ARTICLE_URL_PREFIX}${pmid}`}
                        variant="outlined"
                        size="small"
                        color="success"
                        sx={{ marginRight: '15px' }}
                    >
                        view study in pubmed
                    </Button>
                )}
                {articleLink && (
                    <Button
                        size="small"
                        variant="outlined"
                        rel="noopener"
                        target="_blank"
                        color="secondary"
                        href={articleLink}
                    >
                        View article
                    </Button>
                )}
            </Box>
            <Typography color="primary" noWrap variant="h6">
                {articleYear ? `(${articleYear})` : ''} {title}
            </Typography>
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
