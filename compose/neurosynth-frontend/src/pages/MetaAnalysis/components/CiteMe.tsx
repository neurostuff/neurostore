import {
    Box,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    Typography,
} from '@mui/material';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import { useCitationCopy } from 'hooks/useCitationCopy';
import { CitationFormat, FORMAT_LABELS } from 'hooks/useCitationCopy.consts';
import { useState } from 'react';

const CITATION_FORMAT_ORDER: CitationFormat[] = ['apa', 'bibtex', 'vancouver', 'harvard1'];

const CiteMe: React.FC = () => {
    const { isCitationLoading, citationPayload } = useCitationCopy();
    const [selectedFormat, setSelectedFormat] = useState<CitationFormat>('apa');

    const handleFormatChange = (event: SelectChangeEvent<CitationFormat>) => {
        setSelectedFormat(event.target.value as CitationFormat);
    };

    if (isCitationLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
                <CircularProgress size={32} />
            </Box>
        );
    }

    if (!citationPayload) {
        return null;
    }

    const selectedCitation = citationPayload[selectedFormat];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Copy citations in your preferred format:</Typography>
            <FormControl size="small" sx={{ minWidth: 200, my: 1 }}>
                <InputLabel id="citation-format-label">Citation Format</InputLabel>
                <Select
                    labelId="citation-format-label"
                    value={selectedFormat}
                    size="medium"
                    label="Citation Format"
                    onChange={handleFormatChange}
                >
                    {CITATION_FORMAT_ORDER.map((format) => (
                        <MenuItem key={format} value={format}>
                            {FORMAT_LABELS[format]}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            {selectedCitation && (
                <CodeSnippet title={FORMAT_LABELS[selectedFormat]} linesOfCode={selectedCitation.split('\n')} />
            )}
        </Box>
    );
};

export default CiteMe;
