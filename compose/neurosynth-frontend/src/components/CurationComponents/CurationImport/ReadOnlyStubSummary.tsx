import { Box, Typography, Chip, Button } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import { PUBMED_ARTICLE_URL_PREFIX } from 'hooks/requests/useGetPubMedIds';

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
        <Box sx={{ padding: '0.25rem', paddingBottom: '1rem' }}>
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
            {articleLink.length > 0 && (
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
            <Typography color="primary" noWrap variant="h6">
                {articleYear ? `(${articleYear})` : ''} {title}
            </Typography>
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
            <Typography variant="h6">{journal}</Typography>
            <Typography sx={{ fontWeight: 'bold' }}>{keywords}</Typography>
            <Typography variant="body1">{authors}</Typography>
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
