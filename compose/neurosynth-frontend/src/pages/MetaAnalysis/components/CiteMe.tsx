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
import { useQuery } from '@tanstack/react-query';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import { getLatestMetaAnalysisResultId } from 'helpers/MetaAnalysis.helpers';
import { useGetMetaAnalysisResultById } from 'hooks';
import { useCitationCopy } from 'hooks/useCitationCopy';
import { CitationFormat, FORMAT_LABELS } from 'hooks/useCitationCopy.consts';
import { MetaAnalysisReturn } from 'neurosynth-compose-typescript-sdk';
import { formatNimareMethodDescription } from 'pages/MetaAnalysis/Nimare.helpers';
import { useState } from 'react';

const CITATION_FORMAT_ORDER: CitationFormat[] = ['apa', 'bibtex', 'vancouver', 'harvard1'];

const CiteMe = ({ metaAnalysis }: { metaAnalysis: MetaAnalysisReturn | undefined }) => {
    const { isCitationLoading, citationPayload } = useCitationCopy();
    const [selectedFormat, setSelectedFormat] = useState<CitationFormat>('apa');

    const { data: metaAnalysisResult } = useGetMetaAnalysisResultById(getLatestMetaAnalysisResultId(metaAnalysis));
    const methodDescription = metaAnalysisResult?.method_description;
    const methodReferences = metaAnalysisResult?.method_references;
    const composeRunnerVersion = metaAnalysisResult?.cli_version;

    const { data: formattedMethods, isLoading: isFormattedMethodsLoading } = useQuery({
        queryKey: ['formatted-method-description', methodDescription, methodReferences],
        queryFn: () => formatNimareMethodDescription(methodDescription || '', methodReferences),
        enabled: !!methodDescription,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
    });

    const handleFormatChange = (event: SelectChangeEvent<CitationFormat>) => {
        setSelectedFormat(event.target.value as CitationFormat);
    };

    const selectedCitation = citationPayload?.[selectedFormat];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(methodDescription || composeRunnerVersion) && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                    <Typography variant="h6">Methods</Typography>
                    {composeRunnerVersion && (
                        <Typography variant="body2" color="text.secondary">
                            Run with compose-runner {composeRunnerVersion}, which pins the NiMARE version used for this
                            meta-analysis.
                        </Typography>
                    )}
                    {methodDescription && isFormattedMethodsLoading ? (
                        <CircularProgress size={24} />
                    ) : methodDescription ? (
                        <>
                            <CodeSnippet
                                sx={{ whiteSpace: 'normal', overflow: 'auto' }}
                                title="Methods"
                                linesOfCode={(formattedMethods?.description || methodDescription).split('\n')}
                            />
                            {formattedMethods?.references && (
                                <CodeSnippet
                                    sx={{ whiteSpace: 'normal', overflow: 'auto' }}
                                    title="References"
                                    linesOfCode={formattedMethods.references.split('\n')}
                                />
                            )}
                        </>
                    ) : null}
                </Box>
            )}
            {isCitationLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
                    <CircularProgress size={32} />
                </Box>
            ) : citationPayload ? (
                <>
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
                        <CodeSnippet
                            sx={{ whiteSpace: 'normal', overflow: 'auto' }}
                            title={FORMAT_LABELS[selectedFormat]}
                            linesOfCode={selectedCitation.split('\n')}
                        />
                    )}
                </>
            ) : null}
        </Box>
    );
};

export default CiteMe;
