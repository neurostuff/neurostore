import { Paper, Stack } from '@mui/material';
import StudyAnalysesList from 'pages/Study/components/StudyAnalysesList';
import { STUDY_ANALYSES_PANEL_HEIGHT } from 'pages/Study/components/Study.styles';
import { useEffect, useMemo, useState } from 'react';
import StudyAnalysis from 'pages/Study/components/StudyAnalysis';
import { IStoreAnalysis } from 'stores/study/StudyStore.helpers';

const StudyAnalyses = (props: { id: string | undefined; analyses: IStoreAnalysis[] }) => {
    const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | undefined>('');

    useEffect(() => {
        if (props.analyses.length <= 0) return;
        setSelectedAnalysisId(props.analyses[0].id);
    }, [props.analyses, props.id]);

    const handleSelectAnalysis = (id: string) => {
        const index = props.analyses.findIndex((a) => a.id === id);
        if (index < 0) {
            return;
        } else {
            setSelectedAnalysisId(props.analyses[index].id);
        }
    };

    const selectedAnalysis = useMemo(() => {
        return props.analyses.find((a) => a.id === selectedAnalysisId);
    }, [props.analyses, selectedAnalysisId]);

    return (
        <Stack direction="row" spacing={2} alignItems="stretch" sx={{ height: STUDY_ANALYSES_PANEL_HEIGHT }}>
            <Paper
                variant="outlined"
                sx={{
                    width: 250,
                    flexShrink: 0,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                <StudyAnalysesList
                    selectedId={selectedAnalysisId}
                    onSelectAnalysisIndex={handleSelectAnalysis}
                    analyses={props.analyses}
                />
            </Paper>
            {selectedAnalysis && (
                <Paper
                    variant="outlined"
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'auto',
                    }}
                >
                    <Stack p={2} flex={1} minHeight={0}>
                        <StudyAnalysis {...selectedAnalysis} />
                    </Stack>
                </Paper>
            )}
        </Stack>
    );
};

export default StudyAnalyses;
