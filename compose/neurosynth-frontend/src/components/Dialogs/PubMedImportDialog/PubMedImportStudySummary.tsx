import { Box, Link, Typography, Chip } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import TextExpansion from 'components/TextExpansion/TextExpansion';

const PubMedImportStudySummary: React.FC<ICurationStubStudy> = (props) => {
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
    } = props;

    return (
        <Box sx={{ padding: '0.25rem', paddingBottom: '0.5rem' }}>
            <Link
                rel="noopener"
                underline="hover"
                color="primary"
                target="_blank"
                href={articleLink}
            >
                <Typography variant="h6">
                    {articleYear ? `(${articleYear})` : ''} {title}
                </Typography>
            </Link>
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

export default PubMedImportStudySummary;