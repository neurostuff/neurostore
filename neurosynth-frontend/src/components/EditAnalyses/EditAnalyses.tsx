import { Typography, Box, Tabs, Tab, TextField, Slide } from '@mui/material';
import { useEffect, useState, SyntheticEvent } from 'react';
import { AnalysisApiResponse } from '../../utils/api';
import EditAnalysesStyles from './EditAnalysesStyles';

export interface IEditAnalyses {
    analyses: AnalysisApiResponse[] | undefined;
    onEditAnalyses: (args: AnalysisApiResponse[]) => void;
}

// // sort
// const analyses = (study.analyses as AnalysisApiResponse[]).sort((a, b) => {
//     const aId = a.id as string;
//     const bId = b.id as string;
//     if (aId < bId) {
//         return -1;
//     }
//     if (aId > bId) {
//         return 1;
//     }
//     return 0;
// });
// if (study.analyses && study.analyses.length > 0) {
//     setSelectedAnalysis((prevState) => ({
//         analysis: (study.analyses as AnalysisApiResponse[])[
//             prevState.analysisIndex
//         ],
//         analysisIndex: prevState.analysisIndex,
//     }));
// }

const EditAnalyses: React.FC<IEditAnalyses> = (props) => {
    const [analyses, setAnalyses] = useState<AnalysisApiResponse[] | undefined>(props.analyses);

    const [editTab, setEditTab] = useState(0);

    const [selectedAnalysis, setSelectedAnalysis] = useState<{
        analysisIndex: number;
        analysis: AnalysisApiResponse | undefined;
    }>({
        analysisIndex: 0,
        analysis: undefined,
    });

    useEffect(() => {
        if (props.analyses && props.analyses.length > 0) {
            const sortedAnalyses = (props.analyses as AnalysisApiResponse[]).sort((a, b) => {
                const aId = a.id as string;
                const bId = b.id as string;
                if (aId < bId) {
                    return -1;
                }
                if (aId > bId) {
                    return 1;
                }
                return 0;
            });
            setAnalyses(sortedAnalyses);

            setSelectedAnalysis({
                analysisIndex: 0,
                analysis: sortedAnalyses[0],
            });
        }
    }, [props]);

    const handleEditAnalysis = (event: SyntheticEvent) => {};

    const textFieldInputProps = {
        style: {
            fontSize: 15,
        },
    };

    const hasAnalyses = !!analyses && analyses.length > 0;

    return (
        <>
            <Typography variant="h6">
                <b>Edit Analyses</b>
            </Typography>

            {!hasAnalyses && (
                <Box component="span" sx={{ color: 'warning.dark' }}>
                    No analyses for this study
                </Box>
            )}

            {hasAnalyses && (
                <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
                    <Box>
                        <Tabs
                            scrollButtons
                            sx={{
                                borderRight: 1,
                                color: 'lightgray',
                                maxWidth: {
                                    xs: 90,
                                    md: 150,
                                },
                            }}
                            TabScrollButtonProps={{
                                sx: {
                                    color: 'primary.main',
                                },
                            }}
                            value={selectedAnalysis.analysisIndex}
                            onChange={(event: SyntheticEvent, newVal: number) => {
                                setSelectedAnalysis({
                                    analysis: (analyses as AnalysisApiResponse[])[newVal],
                                    analysisIndex: newVal,
                                });
                            }}
                            orientation="vertical"
                            variant="scrollable"
                        >
                            {(analyses as AnalysisApiResponse[]).map((analysis, index) => (
                                <Tab value={index} label={analysis.name}></Tab>
                            ))}
                        </Tabs>
                    </Box>
                    <Box
                        sx={{
                            paddingLeft: {
                                xs: '10px',
                                md: '20px',
                            },
                            paddingTop: {
                                xs: '6px',
                                md: '12px',
                            },
                            flexGrow: 1,
                        }}
                    >
                        <TextField
                            sx={EditAnalysesStyles.textfield}
                            variant="outlined"
                            label="Edit Analysis Name"
                            value={selectedAnalysis.analysis?.name || ''}
                            InputProps={textFieldInputProps}
                            name="name"
                            onChange={handleEditAnalysis}
                        />

                        <TextField
                            sx={EditAnalysesStyles.textfield}
                            variant="outlined"
                            label="Edit Analysis Description"
                            value={selectedAnalysis.analysis?.description || ''}
                            InputProps={textFieldInputProps}
                            name="description"
                            onChange={handleEditAnalysis}
                        />

                        <Box sx={{ overflowX: 'hidden' }}>
                            <Tabs
                                sx={{
                                    borderBottom: 1,
                                    color: 'lightgray',
                                }}
                                TabScrollButtonProps={{
                                    sx: {
                                        color: 'primary.main',
                                    },
                                }}
                                value={editTab}
                                onChange={(event: SyntheticEvent, newValue: number) => {
                                    setEditTab(newValue);
                                }}
                            >
                                <Tab value={0} label="Edit Coordinates"></Tab>
                                <Tab value={1} label="Edit Conditions"></Tab>
                                <Tab value={2} label="Edit Images"></Tab>
                            </Tabs>
                            <Slide direction="left" in={editTab === 0}>
                                <Box hidden={editTab !== 0}> first edit tab </Box>
                            </Slide>
                            <Slide direction="left" in={editTab === 1}>
                                <Box hidden={editTab !== 1}> second edit tab </Box>
                            </Slide>
                            <Slide direction="left" in={editTab === 2}>
                                <Box hidden={editTab !== 2}> third edit tab </Box>
                            </Slide>
                        </Box>
                    </Box>
                </Box>
            )}
        </>
    );
};

export default EditAnalyses;
