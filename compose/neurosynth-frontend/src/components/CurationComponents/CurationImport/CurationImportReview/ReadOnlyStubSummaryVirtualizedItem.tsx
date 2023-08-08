import { Box, Divider, Link, Typography } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { PUBMED_ARTICLE_URL_PREFIX } from 'hooks/external/useGetPubMedIds';

/**
 * Study summary for studies that are being imported and tagged. We cannot reuse the ReadOnlyStubSummary easily here because
 * all data needs to be a one liner with fixed height for virtualization purposes
 */
const ReadOnlyStubSummaryVirtualizedItem: React.FC<
    ICurationStubStudy & { style: React.CSSProperties }
> = (props) => {
    const { articleLink, articleYear, title, authors, pmid, doi, journal, neurostoreId, style } =
        props;

    return (
        <Box
            style={{
                ...style,
                ...{
                    // borderRadius: '4px',
                    // border: '1px solid #ebebeb',
                    height: '120px',
                    padding: '10px 10px',
                    marginBottom: '10px',
                    marginLeft: '10px',
                    width: 'calc(100% - 30px)',
                },
            }}
        >
            <Box>
                {neurostoreId && (
                    <Link
                        underline="hover"
                        target="_blank"
                        href={`/studies/${neurostoreId}`}
                        sx={{ marginRight: '10px' }}
                    >
                        view study in neurostore
                    </Link>
                )}
                {pmid && (
                    <Link
                        underline="hover"
                        target="_blank"
                        href={`${PUBMED_ARTICLE_URL_PREFIX}${pmid}`}
                        sx={{ marginRight: '10px' }}
                    >
                        view study in pubmed
                    </Link>
                )}
                {articleLink && (
                    <Link
                        underline="hover"
                        target="_blank"
                        href={articleLink}
                        sx={{ marginRight: '10px' }}
                    >
                        view article link
                    </Link>
                )}
            </Box>
            <Typography noWrap variant="h6">
                {articleYear ? `(${articleYear})` : ''} {title}
            </Typography>
            <Typography noWrap variant="body1">
                {authors}
            </Typography>
            <Typography noWrap variant="body1">
                {journal}
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
            <Divider sx={{ marginTop: '12px' }} />
        </Box>
    );
};

export default ReadOnlyStubSummaryVirtualizedItem;
