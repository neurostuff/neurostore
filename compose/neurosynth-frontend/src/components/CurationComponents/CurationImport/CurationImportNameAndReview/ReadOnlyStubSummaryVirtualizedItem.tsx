import { Box, Chip, Divider, Tooltip, Typography } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import {
    PUBMED_ARTICLE_URL_PREFIX,
    PUBMED_CENTRAL_ARTICLE_URL_PREFIX,
} from 'hooks/external/useGetPubMedIds';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/**
 * Study summary for studies that are being imported and tagged. We cannot reuse the ReadOnlyStubSummary easily here because
 * all data needs to be a one liner with fixed height for virtualization purposes
 */
const ReadOnlyStubSummaryVirtualizedItem: React.FC<
    ICurationStubStudy & { style: React.CSSProperties }
> = (props) => {
    const {
        articleLink,
        articleYear,
        title,
        authors,
        pmid,
        doi,
        journal,
        neurostoreId,
        style,
        pmcid,
    } = props;

    const articleYearText = articleYear ? `(${articleYear}) ` : '';
    const titleText = title ? `${articleYearText}${title}` : 'No title';

    return (
        <Box
            style={{
                ...style,
                ...{
                    height: '120px',
                    padding: '10px 10px',
                    marginLeft: '10px',
                    width: 'calc(100% - 30px)',
                },
            }}
        >
            <Box>
                {neurostoreId && (
                    <Chip
                        component="a"
                        icon={<OpenInNewIcon />}
                        target="_blank"
                        rel="noreferrer"
                        clickable
                        color="primary"
                        variant="outlined"
                        href={`/base-studies/${neurostoreId}`}
                        sx={{ marginRight: '10px', height: '24px' }}
                        label="view study in neurostore"
                        size="small"
                    />
                )}
                {pmid && (
                    <Chip
                        component="a"
                        icon={<OpenInNewIcon />}
                        target="_blank"
                        rel="noreferrer"
                        clickable
                        color="primary"
                        variant="outlined"
                        href={`${PUBMED_ARTICLE_URL_PREFIX}${pmid}`}
                        sx={{ marginRight: '10px', height: '24px' }}
                        label="view study in pubmed"
                        size="small"
                    />
                )}
                {pmcid && (
                    <Chip
                        component="a"
                        icon={<OpenInNewIcon />}
                        target="_blank"
                        rel="noreferrer"
                        clickable
                        color="primary"
                        variant="outlined"
                        href={`${PUBMED_CENTRAL_ARTICLE_URL_PREFIX}${pmcid}`}
                        sx={{ marginRight: '10px', height: '24px' }}
                        label="view full article (web)"
                        size="small"
                    />
                )}
                {articleLink && (
                    <Chip
                        component="a"
                        icon={<OpenInNewIcon />}
                        target="_blank"
                        rel="noreferrer"
                        clickable
                        color="primary"
                        variant="outlined"
                        href={articleLink}
                        sx={{ marginRight: '10px', height: '24px' }}
                        label="view article link"
                        size="small"
                    />
                )}
            </Box>
            <Typography sx={{ marginTop: '4px' }} noWrap variant="body1">
                {titleText}
            </Typography>
            <Typography sx={{ color: authors ? 'initial' : 'warning.dark' }} noWrap variant="body2">
                {authors || 'No authors'}
            </Typography>
            <Typography sx={{ color: journal ? 'initial' : 'warning.dark' }} noWrap variant="body2">
                {journal || 'No journal'}
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
            <Divider sx={{ marginTop: '5px' }} />
        </Box>
    );
};

export default ReadOnlyStubSummaryVirtualizedItem;
