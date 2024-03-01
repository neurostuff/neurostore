import { Box, Chip, Link, Typography } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import { PUBMED_ARTICLE_URL_PREFIX } from 'hooks/external/useGetPubMedIds';

const ReadOnlyStubSummary: React.FC<ICurationStubStudy> = (props) => {
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
        neurostoreId,
    } = props;

    return (
        <Box sx={{ padding: '0.25rem' }}>
            {neurostoreId && (
                <Link
                    underline="hover"
                    target="_blank"
                    rel="noreferrer"
                    href={`/base-studies/${neurostoreId}`}
                    sx={{ marginRight: '10px' }}
                >
                    view study in neurostore
                </Link>
            )}
            {pmid && (
                <Link
                    underline="hover"
                    target="_blank"
                    rel="noreferrer"
                    href={`${PUBMED_ARTICLE_URL_PREFIX}${pmid}`}
                    sx={{ marginRight: '10px' }}
                >
                    view study in pubmed
                </Link>
            )}
            {articleLink.length > 0 && (
                <Link
                    underline="hover"
                    target="_blank"
                    rel="noreferrer"
                    href={articleLink}
                    sx={{ marginRight: '10px' }}
                >
                    view article
                </Link>
            )}
            <Box>
                {tags.map((tag) => (
                    <Chip
                        sx={{ marginBottom: '4px', marginTop: '4px', marginRight: '5px' }}
                        size="small"
                        key={tag.id}
                        label={tag.label}
                    />
                ))}
            </Box>
            <Typography noWrap variant="h6">
                {articleYear ? `(${articleYear})` : ''} {title}
            </Typography>
            <Typography variant="body1">{authors}</Typography>
            <Typography>{journal}</Typography>
            <Typography sx={{ fontStyle: 'italic' }}>{keywords}</Typography>
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
            <TextExpansion text={abstractText}></TextExpansion>
        </Box>
    );
};

export default ReadOnlyStubSummary;
