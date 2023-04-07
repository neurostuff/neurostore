import { Box } from '@mui/material';
import { AnalysisReturn } from 'neurostore-typescript-sdk';
import DisplayAnalysesList from './DisplayAnalysesList/DisplayAnalysesList';
import { useState } from 'react';
import DisplayAnalysis from './DisplayAnalysis/DisplayAnalysis';

const DisplayAnalyses: React.FC<{
    analyses: AnalysisReturn[];
}> = (props) => {
    const [selectedAnalysisIndex, setSelectedAnalysisIndex] = useState(0);

    const handleSelectAnalysis = (index: number) => {
        setSelectedAnalysisIndex(index);
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
                <Box>
                    <DisplayAnalysis {...selectedAnalysis} />
                </Box>
            </Box>
        </Box>
    );
};

export default DisplayAnalyses;
