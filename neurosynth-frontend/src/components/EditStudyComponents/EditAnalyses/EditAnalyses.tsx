import { Typography, Box, Tabs, Tab, Button, TabProps } from '@mui/material';
import React, { useEffect, useState, SyntheticEvent } from 'react';
import { IEditAnalyses } from '.';
import API, { AnalysisApiResponse } from '../../../utils/api';
import EditAnalysesStyles from './EditAnalyses.styles';
import EditAnalysis from './EditAnalysis/EditAnalysis';

const MemoizedTab: React.FC<TabProps> = React.memo(
    (props) => {
        return <Tab sx={EditAnalysesStyles.tab} {...props} />;
    },
    (p1: any, p2: any) => {
        return p1.selected === p2.selected && p1.label === p2.label && p1.value === p2.value;
    }
);
// mui requires this to recognize this wrapper as a mui Tab component
(MemoizedTab as any).muiName = 'Tab';

const EditAnalyses: React.FC<IEditAnalyses> = React.memo((props) => {
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

            setSelectedAnalysis((prevState) => {
                if (prevState.analysis) {
                    return {
                        analysisIndex: prevState.analysisIndex,
                        analysis: sortedAnalyses[prevState.analysisIndex],
                    };
                } else {
                    return {
                        analysisIndex: 0,
                        analysis: sortedAnalyses[0],
                    };
                }
            });
        }
    }, [props]);

    const handleCreateAnalysis = (event: React.MouseEvent) => {
        API.Services.AnalysesService.analysesPost().then(
            (res) => {
                console.log(res);
            },
            (err) => {
                console.error(err);
            }
        );
        alert('creating analysis WIP');
    };

    const handleDeleteAnalysis = (idToDelete: string | undefined) => {
        alert('delete this analysis: ' + idToDelete);
    };

    const hasAnalyses = !!props.analyses && props.analyses.length > 0;

    return (
        <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6">
                    <b>Edit Analyses</b>
                </Typography>
                <Button onClick={handleCreateAnalysis} variant="outlined">
                    Create new analysis
                </Button>
            </Box>

            {!hasAnalyses && (
                <Box component="span" sx={{ color: 'warning.dark' }}>
                    No analyses for this study
                </Box>
            )}

            {hasAnalyses && (
                <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                    <Box sx={EditAnalysesStyles.matchingSibling}>
                        <Tabs
                            scrollButtons
                            sx={EditAnalysesStyles.analysesTabs}
                            value={selectedAnalysis.analysisIndex}
                            TabScrollButtonProps={{
                                sx: {
                                    color: 'primary.main',
                                },
                            }}
                            onChange={(event: SyntheticEvent, newVal: number) => {
                                setSelectedAnalysis({
                                    analysis: (props.analyses as AnalysisApiResponse[])[newVal],
                                    analysisIndex: newVal,
                                });
                            }}
                            orientation="vertical"
                            variant="scrollable"
                        >
                            {(props.analyses as AnalysisApiResponse[]).map((analysis, index) => {
                                return (
                                    <MemoizedTab
                                        key={analysis.id}
                                        value={index}
                                        label={analysis.name}
                                    />
                                );
                            })}
                        </Tabs>
                    </Box>
                    <Box
                        sx={{
                            ...EditAnalysesStyles.analysisContainer,
                            ...EditAnalysesStyles.heightDefiningSibling,
                        }}
                    >
                        <EditAnalysis
                            analysis={selectedAnalysis.analysis}
                            onEditAnalysisPoints={props.onEditAnalysisPoints}
                            onEditAnalysisDetails={props.onEditAnalysisDetails}
                            onDeleteAnalysis={handleDeleteAnalysis}
                        />
                    </Box>
                </Box>
            )}
        </>
    );
});

export default EditAnalyses;
