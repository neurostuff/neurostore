import { useAuth0 } from '@auth0/auth0-react';
import { Button, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { AxiosError, AxiosResponse } from 'axios';
import React, { useCallback, useState, useEffect, useContext, SyntheticEvent } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { DisplayValuesTable, DisplayValuesTableModel, TextExpansion } from '../../../components';
import DisplayAnalysis from '../../../components/DisplayAnalysis/DisplayAnalysis';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import { Analysis, ReadOnly } from '../../../gen/api';
import API, { StudyApiResponse } from '../../../utils/api';
import StudyPageStyles from './StudyPageStyles';

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
                setStudy(resUpdated.data);

                // check if the analyses array exists and is non zero in the response
                if (!!resUpdated?.data?.analyses && resUpdated.data.analyses.length > 0) {
                    setSelectedAnalysis({
                        analysisIndex: 0,
                        analysis: resUpdated.data.analyses[0] as Analysis & ReadOnly,
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
                history.push(`/studies`);
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

    const metadataForTable: DisplayValuesTableModel = {
        columnHeaders: ['Name', 'Value'],
        rowData: Object.entries(study?.metadata || {}).map(([key, value]) => ({
            uniqueKey: key,
            columnValues: [
                {
                    value: key,
                    colorByType: false,
                    bold: true,
                },
                {
                    value: value,
                    colorByType: true,
                    bold: true,
                },
            ],
        })),
    };

    return (
        <>
            <Box sx={{ ...StudyPageStyles.buttonContainer, ...StudyPageStyles.spaceBelow }}>
                <Tooltip placement="top" title={!isAuthenticated ? 'login to clone study' : ''}>
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
                <TextExpansion
                    text={study?.description || ''}
                    sx={StudyPageStyles.spaceBelow}
                ></TextExpansion>
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
                    <Tab sx={{ fontSize: '1.25rem' }} label="Analyses" />
                    <Tab sx={{ fontSize: '1.25rem' }} label="Metadata" />
                </Tabs>
            </Box>

            {tabIndex === 1 && (
                <Box sx={StudyPageStyles.metadataContainer}>
                    {study && <DisplayValuesTable {...metadataForTable} />}
                </Box>
            )}

            {tabIndex === 0 &&
                (study?.analyses?.length === 0 ? (
                    <Box component="span" sx={{ color: 'warning.dark' }}>
                        No analyses
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', height: '50vh', flexGrow: 1, marginTop: 2 }}>
                        <Tabs
                            sx={{
                                borderRight: 1,
                                color: 'lightgray',
                                maxWidth: {
                                    xs: 100,
                                    md: 200,
                                },
                            }}
                            scrollButtons
                            TabScrollButtonProps={{
                                sx: {
                                    color: 'primary.main',
                                },
                            }}
                            value={selectedAnalysis.analysisIndex}
                            onChange={handleSelectAnalysis}
                            orientation="vertical"
                            variant="scrollable"
                        >
                            {/* manually override analysis type as we know study will be nested
                            and analysis will not be a string */}
                            {(study?.analyses as (Analysis & ReadOnly)[])?.map((analysis) => (
                                <Tab key={analysis.id} label={analysis.name} />
                            ))}
                        </Tabs>
                        <Box sx={{ height: '100%', width: '100%', display: 'flex' }}>
                            <Box sx={{ flexGrow: 1 }}>
                                <DisplayAnalysis {...selectedAnalysis.analysis} />
                            </Box>
                            <Box
                                sx={{
                                    width: '55%',
                                    display: 'flex',
                                    justifyContent: 'end',
                                    alignItems: 'start',
                                }}
                            >
                                <div
                                    style={{
                                        width: '98%',
                                        height: '96%',
                                        backgroundColor: 'black',
                                        color: 'white',
                                    }}
                                >
                                    Papaya Visualizer placeholder
                                </div>
                            </Box>
                        </Box>
                    </Box>
                ))}
        </>
    );
};

export default StudyPage;
