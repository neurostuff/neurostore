import { useAuth0 } from '@auth0/auth0-react';
import { Typography, Box, Tabs, Tab, Button, Divider } from '@mui/material';
import { AxiosError } from 'axios';
import React, { useEffect, useState, SyntheticEvent, useCallback, useContext } from 'react';
import {
    EAnalysisEdit,
    EAnalysisEditButtonType,
    IEditAnalyses,
    IEditAnalysisConditionsFn,
    IEditAnalysisDetailsFn,
    IOnButtonPressFn,
    IUpdateState,
} from '.';
import { ConfirmationDialog } from '../..';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import useIsMounted from '../../../hooks/useIsMounted';
import API, { AnalysisApiResponse, ConditionApiResponse } from '../../../utils/api';
import EditAnalysesStyles from './EditAnalyses.styles';
import EditAnalysis from './EditAnalysis/EditAnalysis';

const EditAnalyses: React.FC<IEditAnalyses> = React.memo((props) => {
    const { onUpdateAnalysis, analyses } = props;

    const { getAccessTokenSilently } = useAuth0();
    const { showSnackbar } = useContext(GlobalContext);
    const isMountedRef = useIsMounted();

    const [selectedAnalysis, setSelectedAnalysis] = useState<{
        analysisIndex: number;
        analysis: AnalysisApiResponse | undefined;
    }>({
        analysisIndex: 0,
        analysis: undefined,
    });
    const [originalAnalysis, setOriginalAnalysis] = useState<AnalysisApiResponse | undefined>();
    const [dialogIsOpen, setDialogIsOpen] = useState(false);
    const [updateState, setUpdateState] = useState<IUpdateState>({
        details: {
            name: false,
            description: false,
        },
        conditions: false,
    });

    /**
     * on first render, sort the analyses and set the current selected analysis to be the first one
     */
    useEffect(() => {
        const sortedAnalyses = (analyses as AnalysisApiResponse[]).sort((a, b) => {
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
                    analysis: prevState.analysis,
                };
            } else {
                return {
                    analysisIndex: 0,
                    analysis: sortedAnalyses.length === 0 ? undefined : sortedAnalyses[0],
                };
            }
        });
    }, []);

    /**
     * every time there is an update to analyses, this means that something has been updated to the DB
     * and we want to replace our local copy of the original with the new update
     */
    useEffect(() => {
        const sortedAnalyses = (analyses as AnalysisApiResponse[]).sort((a, b) => {
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

        setOriginalAnalysis(sortedAnalyses[selectedAnalysis.analysisIndex]);
    }, [analyses, selectedAnalysis.analysisIndex]);

    const handleUpdateAnalysisDetails: IEditAnalysisDetailsFn = useCallback(
        (field, value) => {
            if (selectedAnalysis.analysis?.id) {
                setSelectedAnalysis((prevState) => {
                    if (!prevState.analysis) return prevState;
                    return {
                        ...prevState,
                        analysis: {
                            ...prevState.analysis,
                            [field]: value,
                        },
                    };
                });

                setUpdateState((prevState) => {
                    const updatedDetails = prevState.details;
                    return {
                        ...prevState,
                        details: {
                            ...updatedDetails,
                            [field]: true,
                        },
                    };
                });
            }
        },
        [selectedAnalysis.analysis?.id]
    );

    const handleUpdateAnalysisConditions: IEditAnalysisConditionsFn = useCallback(
        (conditions, weights) => {
            if (selectedAnalysis.analysis?.id) {
                setSelectedAnalysis((prevState) => {
                    if (!prevState) return prevState;
                    return {
                        ...prevState,
                        analysis: {
                            ...prevState.analysis,
                            conditions,
                            weights,
                        },
                    };
                });

                setUpdateState((prevState) => {
                    return {
                        ...prevState,
                        conditions: true,
                    };
                });
            }
        },
        [selectedAnalysis.analysis?.id]
    );

    const handleSave = useCallback(
        async (editor: EAnalysisEdit) => {
            if (!selectedAnalysis.analysis?.id) return;

            try {
                const token = await getAccessTokenSilently();
                API.UpdateServicesWithToken(token);
            } catch (exception) {
                showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }

            const analysis: AnalysisApiResponse = {};
            if (editor === EAnalysisEdit.DETAILS || editor === EAnalysisEdit.ALL) {
                analysis.name = selectedAnalysis.analysis?.name;
                analysis.description = selectedAnalysis.analysis?.description;
            }
            if (editor === EAnalysisEdit.CONDITIONS || editor === EAnalysisEdit.ALL) {
                analysis.conditions = (
                    selectedAnalysis.analysis?.conditions as ConditionApiResponse[]
                ).map((x) => x.id || '');
                analysis.weights = selectedAnalysis.analysis?.weights;
            }

            API.Services.AnalysesService.analysesIdPut(selectedAnalysis.analysis?.id, analysis)
                .then((_res) => {
                    if (isMountedRef.current) {
                        let update = { ...selectedAnalysis.analysis };
                        if (editor === EAnalysisEdit.DETAILS) {
                            // propagate the changes, but not for conditions
                            update.conditions = originalAnalysis?.conditions;
                            update.weights = originalAnalysis?.weights;
                        } else if (editor === EAnalysisEdit.CONDITIONS) {
                            // propagate the changes, but not for details
                            update.name = originalAnalysis?.name;
                            update.description = originalAnalysis?.description;
                        }

                        onUpdateAnalysis(selectedAnalysis.analysis?.id || '', update);

                        setUpdateState((prevState) => {
                            if (editor === EAnalysisEdit.ALL) {
                                return {
                                    conditions: false,
                                    details: {
                                        name: false,
                                        description: false,
                                    },
                                };
                            }
                            return {
                                ...prevState,
                                ...(editor === EAnalysisEdit.DETAILS
                                    ? { details: { name: false, description: false } }
                                    : { conditions: false }),
                            };
                        });
                        showSnackbar('analysis successfully updated', SnackbarType.SUCCESS);
                    }
                })
                .catch((err: Error | AxiosError) => {
                    showSnackbar('there was an error', SnackbarType.ERROR);
                    console.error(err.message);
                });
        },
        [
            getAccessTokenSilently,
            isMountedRef,
            originalAnalysis?.conditions,
            originalAnalysis?.description,
            originalAnalysis?.name,
            originalAnalysis?.weights,
            selectedAnalysis.analysis,
            onUpdateAnalysis,
            showSnackbar,
        ]
    );

    const handleCancelEdit = useCallback(
        (editor: EAnalysisEdit) => {
            const analysisUpdates: AnalysisApiResponse = {};
            const updates: any = {};
            if (editor === EAnalysisEdit.DETAILS || editor === EAnalysisEdit.ALL) {
                analysisUpdates.name = originalAnalysis?.name;
                analysisUpdates.description = originalAnalysis?.description;
                updates.details = {
                    name: false,
                    description: false,
                };
            }
            if (editor === EAnalysisEdit.CONDITIONS || editor === EAnalysisEdit.ALL) {
                analysisUpdates.conditions = originalAnalysis?.conditions;
                analysisUpdates.weights = originalAnalysis?.weights;
                updates.conditions = false;
            }

            setSelectedAnalysis((prevState) => {
                if (!prevState.analysis) return prevState;
                return {
                    ...prevState,
                    analysis: {
                        ...prevState.analysis,
                        ...analysisUpdates,
                    },
                };
            });
            setUpdateState((prevState) => {
                if (!prevState) return prevState;
                return {
                    ...prevState,
                    ...updates,
                };
            });
        },
        [
            originalAnalysis?.conditions,
            originalAnalysis?.description,
            originalAnalysis?.name,
            originalAnalysis?.weights,
        ]
    );

    const handleButtonPress: IOnButtonPressFn = useCallback(
        (editor, buttonType) => {
            switch (buttonType) {
                case EAnalysisEditButtonType.SAVE:
                    handleSave(editor);
                    break;
                case EAnalysisEditButtonType.CANCEL:
                    handleCancelEdit(editor);
                    break;
                default:
                    break;
            }
        },
        [handleCancelEdit, handleSave]
    );

    const handleCreateAnalysis = (event: React.MouseEvent) => {
        alert('This has not been implemented yet. Please check back later');
    };

    const handleTabChange = (event: SyntheticEvent, newVal: number) => {
        if (updateState.conditions || updateState.details.name || updateState.details.description) {
            setDialogIsOpen(true);
        } else {
            setSelectedAnalysis({
                analysis: (analyses as AnalysisApiResponse[])[newVal],
                analysisIndex: newVal,
            });
        }
    };

    const hasAnalyses = !!analyses && analyses.length > 0;

    return (
        <>
            <ConfirmationDialog
                dialogTitle="Unsaved Changes"
                dialogMessage="You are trying to switch to a new analysis. Do you want to save the changes you've made to the current analysis?"
                isOpen={dialogIsOpen}
                confirmText="Save changes"
                rejectText="Discard changes"
                onCloseDialog={(res) => {
                    setDialogIsOpen(false);
                    switch (res) {
                        case true:
                            handleSave(EAnalysisEdit.ALL);
                            break;
                        case false:
                            handleCancelEdit(EAnalysisEdit.ALL);
                            break;
                        default:
                            break;
                    }
                }}
            />
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    marginBottom: '15px',
                }}
            >
                <Typography variant="h6">
                    <b>Edit Analyses</b>
                </Typography>
                <Button sx={{ width: '200px' }} onClick={handleCreateAnalysis} variant="contained">
                    Create new analysis
                </Button>
            </Box>

            {!hasAnalyses && (
                <Box component="span" sx={{ color: 'warning.dark' }}>
                    No analyses for this study
                </Box>
            )}

            {hasAnalyses && (
                <>
                    <Divider />
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
                                onChange={handleTabChange}
                                orientation="vertical"
                                variant="scrollable"
                            >
                                {(analyses as AnalysisApiResponse[]).map((analysis, index) => {
                                    return (
                                        <Tab
                                            sx={EditAnalysesStyles.tab}
                                            key={analysis.id}
                                            value={index}
                                            label={analysis.name}
                                        />
                                    );
                                })}
                            </Tabs>
                        </Box>
                        <Box
                            sx={[
                                EditAnalysesStyles.analysisContainer,
                                EditAnalysesStyles.heightDefiningSibling,
                            ]}
                        >
                            <EditAnalysis
                                updateState={updateState}
                                analysis={selectedAnalysis.analysis}
                                onEditAnalysisDetails={handleUpdateAnalysisDetails}
                                onEditAnalysisConditions={handleUpdateAnalysisConditions}
                                onEditAnalysisButtonPress={handleButtonPress}
                            />
                        </Box>
                    </Box>
                </>
            )}
        </>
    );
});

export default EditAnalyses;
