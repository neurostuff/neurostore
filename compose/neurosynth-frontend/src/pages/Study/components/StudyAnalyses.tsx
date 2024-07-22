import { Box } from '@mui/material';
import StudyAnalysesList from './StudyAnalysesList';
import { useEffect, useMemo, useState } from 'react';
import StudyAnalysis from './StudyAnalysis';
import { IStoreAnalysis } from 'pages/Study/store/StudyStore.helpers';

const StudyAnalyses: React.FC<{
    id: string | undefined;
    analyses: IStoreAnalysis[];
}> = (props) => {
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
        <Box sx={{ display: 'flex' }}>
            <StudyAnalysesList
                selectedId={selectedAnalysisId}
                onSelectAnalysisIndex={handleSelectAnalysis}
                analyses={props.analyses}
            />
            {selectedAnalysis && (
                <Box sx={{ padding: '1rem', width: 'calc(100% - 250px - 2rem)', height: '100%' }}>
                    <StudyAnalysis {...selectedAnalysis} />
                </Box>
            )}
        </Box>
    );
};

export default StudyAnalyses;
