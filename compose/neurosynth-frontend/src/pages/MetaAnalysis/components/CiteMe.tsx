import { Box, Typography } from '@mui/material';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import { useCitationCopy } from 'hooks/useCitationCopy';
import { CitationFormat, FORMAT_LABELS } from 'hooks/useCitationCopy.consts';

const CiteMe: React.FC = () => {
    const { copyCitations, isCitationLoading, citationPayload } = useCitationCopy();
    console.log({ copyCitations, isCitationLoading, citationPayload });

    return (
        <Box>
            <Typography variant="h6" mb={2}>
                Copy citations in your preferred format:
            </Typography>
            {Object.entries(citationPayload ?? {}).map(([format, citation]) => {
                const formattedLabel = FORMAT_LABELS[format as CitationFormat];

                return (
                    <Box key={format} mb={4} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <CodeSnippet title={formattedLabel} linesOfCode={citation.split('\n')} />
                    </Box>
                );
            })}
        </Box>
    );
};

export default CiteMe;
