import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Chip, Divider, Typography } from '@mui/material';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { PUBMED_ARTICLE_URL_PREFIX, PUBMED_CENTRAL_ARTICLE_URL_PREFIX } from 'hooks/external/useGetPubMedIds';

/**
 * Study summary for studies that are being imported and tagged. We cannot reuse the ReadOnlyStubSummary easily here because
 * all data needs to be a one liner with fixed height for virtualization purposes
 */
const CurationImportFinalizeReviewVirtualizedListItem: React.FC<ICurationStubStudy & { style: React.CSSProperties }> = (
    props
) => {
    const { articleLink, articleYear, title, authors, pmid, doi, journal, neurostoreId, style, pmcid } = props;

    const articleYearText = articleYear ? `(${articleYear}). ` : '';
    const titleText = title ? `${articleYearText}${title}` : 'No title';

    return (
        <Box
            style={{
                ...style,
                height: '95px',
                width: 'calc(100% - 15px)',
            }}
        >
            <Box>
                {neurostoreId && (
                    <Chip
                        component="a"
                        icon={<OpenInNewIcon sx={{ height: '12px' }} />}
                        target="_blank"
                        rel="noreferrer"
                        clickable
                        color="primary"
                        variant="outlined"
                        href={`/base-studies/${neurostoreId}`}
                        sx={{ marginRight: '10px', height: '16px', fontSize: '10px' }}
                        label="view study in neurostore"
                        size="small"
                    />
                )}
                {pmid && (
                    <Chip
                        component="a"
                        icon={<OpenInNewIcon sx={{ height: '12px' }} />}
                        target="_blank"
                        rel="noreferrer"
                        clickable
                        color="primary"
                        variant="outlined"
                        href={`${PUBMED_ARTICLE_URL_PREFIX}${pmid}`}
                        sx={{ marginRight: '10px', height: '16px', fontSize: '10px' }}
                        label="view study in pubmed"
                        size="small"
                    />
                )}
                {pmcid && (
                    <Chip
                        component="a"
                        icon={<OpenInNewIcon sx={{ height: '12px' }} />}
                        target="_blank"
                        rel="noreferrer"
                        clickable
                        color="primary"
                        variant="outlined"
                        href={`${PUBMED_CENTRAL_ARTICLE_URL_PREFIX}${pmcid}`}
                        sx={{ marginRight: '10px', height: '16px', fontSize: '10px' }}
                        label="view full article (web)"
                        size="small"
                    />
                )}
                {articleLink && (
                    <Chip
                        component="a"
                        icon={<OpenInNewIcon sx={{ height: '12px' }} />}
                        target="_blank"
                        rel="noreferrer"
                        clickable
                        color="primary"
                        variant="outlined"
                        href={articleLink}
                        sx={{ marginRight: '10px', height: '16px', fontSize: '10px' }}
                        label="view article link"
                        size="small"
                    />
                )}
            </Box>
            <Typography
                sx={{ marginTop: '4px', fontSize: '12px' }}
                noWrap
                variant="body2"
                fontWeight="bold"
                gutterBottom={false}
            >
                {titleText}
            </Typography>
            <Typography sx={{ color: authors ? 'initial' : 'warning.dark', display: 'block', fontSize: '10px' }} noWrap>
                {authors || 'No authors'}
            </Typography>
            <Typography sx={{ color: journal ? 'initial' : 'warning.dark', display: 'block', fontSize: '10px' }} noWrap>
                {journal || 'No journal'}
            </Typography>
            <Box sx={{ display: 'flex' }}>
                <Box sx={{ marginRight: '2rem', display: 'flex' }}>
                    <Typography sx={{ fontSize: '10px' }}>PMID: </Typography>
                    <Typography sx={{ fontSize: '10px', color: pmid ? 'initial' : 'warning.dark' }}>
                        {pmid || 'none'}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <Typography sx={{ fontSize: '10px' }}>DOI: </Typography>
                    <Typography sx={{ fontSize: '10px', color: doi ? 'initial' : 'warning.dark' }}>
                        {doi || 'none'}
                    </Typography>
                </Box>
            </Box>
            <Divider sx={{ marginTop: '5px' }} />
        </Box>
    );
};

export default CurationImportFinalizeReviewVirtualizedListItem;
