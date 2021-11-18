import { useAuth0 } from '@auth0/auth0-react';
import { Button, Tooltip, Typography, Tab, Tabs, Box } from '@mui/material';
import { AxiosError, AxiosResponse } from 'axios';
import React, { useCallback, useState, useEffect, useContext, SyntheticEvent } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
    DisplayValuesTable,
    IDisplayValuesTableModel,
    TextExpansion,
    DisplayAnalysis,
} from '../../../components';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import { Analysis, ReadOnly } from '../../../gen/api';
import API, { StudyApiResponse, AnalysisApiResponse } from '../../../utils/api';
import StudyPageStyles from './StudyPage.styles';

const StudyPage = () => {
    const [study, setStudy] = useState<StudyApiResponse>();
    const [tabIndex, setTabIndex] = useState(0);
    const [selectedAnalysis, setSelectedAnalysis] = useState<{
        analysisIndex: number;
        analysis: (Analysis & ReadOnly) | undefined;
    }>({
        analysisIndex: 0,
        analysis: undefined,
    });

    const [editDisabled, setEditDisabled] = useState(true);
    const context = useContext(GlobalContext);
    const history = useHistory();
    const { isAuthenticated, getAccessTokenSilently, user } = useAuth0();
    const params: { studyId: string } = useParams();

    const getStudy = useCallback((id: string) => {
        API.Services.StudiesService.studiesIdGet(id, true)
            .then((res) => {
                const resUpdated = res as AxiosResponse<StudyApiResponse>;

                let sortedAnalyses = resUpdated.data.analyses as AnalysisApiResponse[] | undefined;
                if (sortedAnalyses && sortedAnalyses.length > 0) {
                    sortedAnalyses.sort((a, b) => {
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
                }

                setStudy(resUpdated.data);

                // check if the analyses array exists and is non zero in the response
                if (sortedAnalyses && sortedAnalyses.length > 0) {
                    setSelectedAnalysis({
                        analysisIndex: 0,
                        analysis: sortedAnalyses[0],
                    });
                }
            })
            .catch((err) => {
                console.log(err);
            });
    }, []);

    const handleCloneStudy = async () => {
        try {
            const token = await getAccessTokenSilently();
            context?.handleToken(token);
        } catch (exception) {
            context.showSnackbar('There was an error', SnackbarType.ERROR);
            console.error(exception);
        }
        API.Services.StudiesService.studiesPost(undefined, params.studyId, {})
            .then((res) => {
                context.showSnackbar('Study successfully cloned', SnackbarType.SUCCESS);
                history.push(`/studies/${(res.data as any).id}`);
            })
            .catch((err: Error | AxiosError) => {
                context.showSnackbar('There was an error', SnackbarType.ERROR);
                console.log(err.message);
            });
    };

    const handleEditStudy = (event: React.MouseEvent) => {
        history.push(`/studies/edit/${params.studyId}`);
    };

    const handleSelectAnalysis = (event: SyntheticEvent, newVal: number) => {
        setSelectedAnalysis({
            analysisIndex: newVal,
            analysis: (study?.analyses as (Analysis & ReadOnly)[])[newVal],
        });
    };

    useEffect(() => {
        if (params.studyId) {
            getStudy(params.studyId);
        }
    }, [params.studyId, getStudy]);

    useEffect(() => {
        const userIDAndStudyIDExist = !!user?.sub && !!study?.user;
        const shouldDisableEdit =
            !isAuthenticated || !userIDAndStudyIDExist || user?.sub !== study?.user;
        setEditDisabled(shouldDisableEdit);
    }, [isAuthenticated, user?.sub, study?.user]);

    const metadataForTable: IDisplayValuesTableModel = {
        columnHeaders: [
            {
                value: 'Name',
                center: false,
                bold: false,
            },
            {
                value: 'Value',
                center: false,
                bold: false,
            },
        ],
        rowData: Object.entries(study?.metadata || {}).map(([key, value]) => ({
            uniqueKey: key,
            columnValues: [
                {
                    value: key,
                    colorByType: false,
                    center: false,
                    bold: true,
                },
                {
                    value: value,
                    colorByType: true,
                    center: false,
                    bold: true,
                },
            ],
        })),
    };

    return (
        <>
            <Box sx={{ ...StudyPageStyles.buttonContainer, ...StudyPageStyles.spaceBelow }}>
                <Tooltip placement="top" title={!isAuthenticated ? 'log in to clone study' : ''}>
                    <Box sx={{ display: 'inline' }}>
                        <Button
                            onClick={handleCloneStudy}
                            disabled={!isAuthenticated}
                            variant="outlined"
                            color="primary"
                        >
                            Clone Study
                        </Button>
                    </Box>
                </Tooltip>
                <Tooltip
                    placement="top"
                    title={editDisabled ? 'you can only edit studies you have cloned' : ''}
                >
                    <Box sx={{ display: 'inline' }}>
                        <Button
                            disabled={editDisabled}
                            onClick={handleEditStudy}
                            variant="outlined"
                            color="secondary"
                        >
                            Edit Study
                        </Button>
                    </Box>
                </Tooltip>
            </Box>
            <Box>
                <Typography sx={StudyPageStyles.spaceBelow} variant="h5">
                    <b>{study?.name}</b>
                </Typography>
                <Typography sx={StudyPageStyles.spaceBelow} variant="h6">
                    {study?.authors}
                </Typography>
                <Box sx={StudyPageStyles.spaceBelow}>
                    <Typography variant="h6">{study?.publication}</Typography>
                    {study?.doi && <Typography variant="h6">DOI: {study?.doi}</Typography>}
                </Box>
                <TextExpansion text={study?.description || ''} sx={StudyPageStyles.spaceBelow} />
            </Box>

            <Box
                sx={{
                    ...StudyPageStyles.spaceBelow,
                    borderBottom: 1,
                    color: 'lightgray',
                }}
            >
                <Tabs
                    value={tabIndex}
                    onChange={(event: SyntheticEvent, newValue: number) => {
                        setTabIndex(newValue);
                    }}
                >
                    <Tab value={0} sx={StudyPageStyles.tab} label="Study Analyses" />
                    <Tab value={1} sx={StudyPageStyles.tab} label="Study Metadata" />
                </Tabs>
            </Box>

            {tabIndex === 0 &&
                (study?.analyses?.length === 0 ? (
                    <Box component="span" sx={{ color: 'warning.dark' }}>
                        No analyses
                    </Box>
                ) : (
                    /**
                     * The following CSS is applied to make sure that the tab height grows based on the height
                     * of the analysis.
                     * The tab height should expand and match the height if the analysis accordions are expanded
                     */
                    <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                        <Box sx={StudyPageStyles.matchingSibling}>
                            {/* apply flex basis 0 to analyses tabs to make sure it matches sibling */}
                            <Tabs
                                sx={StudyPageStyles.analysesTabs}
                                scrollButtons
                                value={selectedAnalysis.analysisIndex}
                                TabScrollButtonProps={{
                                    sx: {
                                        color: 'primary.main',
                                    },
                                }}
                                onChange={handleSelectAnalysis}
                                orientation="vertical"
                                variant="scrollable"
                            >
                                {/* manually override analysis type as we know study will be nested and analysis will not be a string */}
                                {(study?.analyses as AnalysisApiResponse[])?.map((analysis) => (
                                    <Tab
                                        sx={StudyPageStyles.analysisTab}
                                        key={analysis.id}
                                        label={analysis.name}
                                    />
                                ))}
                            </Tabs>
                        </Box>
                        <Box sx={StudyPageStyles.heightDefiningSibling}>
                            <DisplayAnalysis {...selectedAnalysis.analysis} />
                        </Box>
                    </Box>
                ))}

            {tabIndex === 1 && (
                <Box sx={StudyPageStyles.metadataContainer}>
                    {study && <DisplayValuesTable {...metadataForTable} />}
                </Box>
            )}
        </>
    );
};

export default StudyPage;
