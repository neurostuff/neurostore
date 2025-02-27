import { Box, Tab, Tabs, Typography } from '@mui/material';
import { useGetMetaAnalysisById } from 'hooks';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import DisplayMetaAnalysisResults from './DisplayMetaAnalysisResults';
import DisplayMetaAnalysisSpecification from './MetaAnalysisSpecification';

const MetaAnalysisResult: React.FC = () => {
    const { projectId, metaAnalysisId } = useParams<{
        projectId: string;
        metaAnalysisId: string;
    }>();
    const { data: metaAnalysis } = useGetMetaAnalysisById(metaAnalysisId);
    const [tab, setTab] = useState(0);

    return (
        <Box>
            <Tabs
                sx={{
                    '.MuiTabs-flexContainer': {
                        borderBottom: '1px solid lightgray',
                    },
                    '.MuiButtonBase-root.Mui-selected': {
                        backgroundColor: 'white',
                        border: '1px solid',
                        borderTopLeftRadius: '6px',
                        borderTopRightRadius: '6px',
                        borderColor: 'lightgray',
                        borderBottom: '0px',
                        marginBottom: '-2px',
                    },
                    '.MuibuttonBase-root': {},
                    transition: 'none',
                }}
                TabIndicatorProps={{
                    sx: {
                        display: 'none',
                    },
                }}
                value={tab}
                onChange={(_, newValue) => setTab(newValue)}
            >
                <Tab value={0} label="Meta Analysis Result" />
                <Tab value={1} label="Specification" />
            </Tabs>

            {tab === 0 ? (
                <Box>
                    <DisplayMetaAnalysisResults metaAnalysis={metaAnalysis} />
                </Box>
            ) : (
                <Box data-tour="MetaAnalysisPage-1" sx={{ marginBottom: '4rem', marginTop: '1rem' }}>
                    <Typography variant="h6" sx={{ marginBottom: '1rem' }}>
                        View Meta-Analysis Specification
                    </Typography>
                    <DisplayMetaAnalysisSpecification
                        metaAnalysisId={metaAnalysisId || ''}
                        projectId={projectId || ''}
                    />
                </Box>
            )}
        </Box>
    );
};

export default MetaAnalysisResult;
