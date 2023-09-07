import { Box } from '@mui/material';
import DisplayAnalysesList from './DisplayAnalysesList/DisplayAnalysesList';
import { useEffect, useState } from 'react';
import DisplayAnalysis from './DisplayAnalysis/DisplayAnalysis';
import { IStoreAnalysis } from 'pages/Studies/StudyStore.helpers';

const DisplayAnalyses: React.FC<{
    id: string | undefined;
    analyses: IStoreAnalysis[];
}> = (props) => {
    const [selectedAnalysisIndex, setSelectedAnalysisIndex] = useState(0);

    useEffect(() => {
        setSelectedAnalysisIndex(0);
    }, [props.id]);

    const handleSelectAnalysis = (index: number) => {
        if (props.analyses[index]) {
            setSelectedAnalysisIndex(index);
        } else {
            setSelectedAnalysisIndex(0);
        }
    };

    const selectedAnalysis = props.analyses[selectedAnalysisIndex];

    return (
        <Box sx={{ display: 'flex' }}>
            <DisplayAnalysesList
                selectedIndex={selectedAnalysisIndex}
                onSelectAnalysisIndex={handleSelectAnalysis}
                analyses={props.analyses}
            />
            <Box sx={{ padding: '1rem', width: '100%', height: '100%' }}>
                <DisplayAnalysis {...selectedAnalysis} />
            </Box>
        </Box>
    );
};

export default DisplayAnalyses;
