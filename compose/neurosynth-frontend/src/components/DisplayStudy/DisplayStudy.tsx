import { Box, Tab, Typography, TableCell, Divider, Tabs, TableRow } from '@mui/material';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthTable, { getValue } from 'components/Tables/NeurosynthTable/NeurosynthTable';
import { AnalysisReturn, StudyReturn } from 'neurostore-typescript-sdk';
import DisplayStudyStyles from './DisplayStudy.styles';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import { sortMetadataArrayFn } from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import { getType } from 'components/EditMetadata';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import DisplayAnalysis from './DisplayAnalyses/DisplayAnalysis/DisplayAnalysis';
import { SyntheticEvent, useEffect, useState } from 'react';
import DisplayAnalyses from './DisplayAnalyses/DisplayAnalyses';

const DisplayStudy: React.FC<StudyReturn> = (props) => {
    const { name, description, doi, pmid, authors, publication, metadata, analyses = [] } = props;

    const [selectedAnalysis, setSelectedAnalysis] = useState<{
        analysisIndex: number;
        analysis: AnalysisReturn | undefined;
    }>({
        analysisIndex: 0,
        analysis: undefined,
    });

    useEffect(() => {
        if (analyses) {
            setSelectedAnalysis({
                analysisIndex: 0,
                analysis: (analyses as AnalysisReturn[])[0],
            });
        }
    }, [analyses]);

    const handleSelectAnalysis = (event: SyntheticEvent, newVal: number) => {
        setSelectedAnalysis({
            analysisIndex: newVal,
            analysis: (analyses as AnalysisReturn[])[newVal],
        });
    };

    return (
        <Box>
            <Box data-tour="StudyPage-1">
                <Typography variant="h6">
                    <b>{name}</b>
                </Typography>
                <Typography>{authors}</Typography>
                <Box sx={DisplayStudyStyles.spaceBelow}>
                    <Typography>{publication}</Typography>
                    {doi && <Typography>DOI: {doi}</Typography>}
                    {pmid && <Typography>PMID: {pmid}</Typography>}
                </Box>
                <TextExpansion
                    text={description || ''}
                    sx={{ ...DisplayStudyStyles.spaceBelow, whiteSpace: 'pre-wrap' }}
                />
            </Box>
            <Box data-tour="StudyPage-2" sx={{ margin: '15px 0' }}>
                <NeurosynthAccordion
                    accordionSummarySx={DisplayStudyStyles.accordionSummary}
                    elevation={2}
                    TitleElement={
                        <Typography variant="h6">
                            <b>Metadata</b>
                        </Typography>
                    }
                >
                    <Box sx={DisplayStudyStyles.metadataContainer}>
                        <NeurosynthTable
                            tableConfig={{
                                tableHeaderBackgroundColor: 'white',
                                tableElevation: 0,
                            }}
                            headerCells={[
                                { text: 'Name', key: 'name', styles: { fontWeight: 'bold' } },
                                { text: 'Value', key: 'value', styles: { fontWeight: 'bold' } },
                            ]}
                            rows={Object.entries(metadata || {})
                                .sort((a, b) => sortMetadataArrayFn(a[0], b[0]))
                                .map(([key, value]) => (
                                    <TableRow key={key}>
                                        <TableCell>{key}</TableCell>
                                        <TableCell
                                            sx={{ color: NeurosynthTableStyles[getType(value)] }}
                                        >
                                            {getValue(value)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                        />
                    </Box>
                </NeurosynthAccordion>
            </Box>

            <Box>
                <Typography
                    data-tour="StudyPage-3"
                    variant="h6"
                    sx={[
                        {
                            marginLeft: '15px',
                            fontWeight: 'bold',
                        },
                        DisplayStudyStyles.spaceBelow,
                    ]}
                >
                    Analyses
                </Typography>
                <Divider />
                {analyses?.length === 0 ? (
                    <Box sx={{ color: 'warning.dark', margin: '15px 0 0 15px' }}>No analyses</Box>
                ) : (
                    <Box sx={{ marginBottom: '1rem' }}>
                        <DisplayAnalyses analyses={analyses as AnalysisReturn[]} />
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default DisplayStudy;
