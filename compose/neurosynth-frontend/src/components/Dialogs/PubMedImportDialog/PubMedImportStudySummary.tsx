import { Box, Link, Typography, Chip } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import TextExpansion from 'components/TextExpansion/TextExpansion';

const PubMedImportStudySummary: React.FC<ICurationStubStudy> = (props) => {
    const { articleLink, articleYear, title, tags, authors, pmid, doi, abstractText } = props;

    return (
        <Box sx={{ padding: '0.25rem' }}>
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
                        sx={{ marginBottom: '4px', marginRight: '5px' }}
                        size="small"
                        key={tag.id}
                        label={tag.label}
                    />
                ))}
            </Box>
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
            <TextExpansion
                textSx={{ whiteSpace: 'break-spaces' }}
                text={abstractText as string}
            ></TextExpansion>
        </Box>
    );
};

export default PubMedImportStudySummary;
