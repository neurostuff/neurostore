import { useAuth0 } from '@auth0/auth0-react';
import { ExpandMoreOutlined } from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Tabs,
    TextField,
    Typography,
    Tab,
} from '@mui/material';
import { AxiosError } from 'axios';
import { useState, useEffect, ChangeEvent, useContext, SyntheticEvent } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { EditMetadata, IMetadataRowModel } from '../../../components';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import { Analysis, ReadOnly } from '../../../gen/api';
import API, { AnalysisApiResponse } from '../../../utils/api';
import EditStudyPageStyles from './EditStudyPageStyles';

interface IStudyEdit {
    name: string;
    authors: string;
    publication: string;
    doi: string;
    description: string;
    metadata: IMetadataRowModel[];
    analyses: AnalysisApiResponse[] | undefined;
}

const textFieldInputProps = {
    style: {
        fontSize: 15,
    },
};

const arrayToMetadata = (arr: IMetadataRowModel[]): { [key: string]: any } => {
    const tempObj: { [key: string]: any } = {};
    arr.forEach((element) => (tempObj[element.metadataKey] = element.metadataValue));
    return tempObj;
};

const EditStudyPage = () => {
    const globalContext = useContext(GlobalContext);
    const { getAccessTokenSilently } = useAuth0();
    const [saveEnabled, setSaveEnabled] = useState(false);

    // study and metadata edits are updated and stored in this state
    const [updatedStudy, setUpdatedStudy] = useState<IStudyEdit>({
        name: '',
        authors: '',
        publication: '',
        doi: '',
        description: '',
        metadata: [],
        analyses: undefined,
    });

    const [selectedAnalysis, setSelectedAnalysis] = useState<{
        analysisIndex: number;
        analysis: AnalysisApiResponse | undefined;
    }>({
        analysisIndex: 0,
        analysis: undefined,
    });

    const [reload, setReload] = useState({});

    // initial metadata received from the study is set in this state. Separate in order to avoid constant re renders
    const [initialMetadataArr, setInitialMetadataArr] = useState<IMetadataRowModel[]>([]);
    const history = useHistory();
    const params: { studyId: string } = useParams();

    const handleMetadataEditChange = (metadata: IMetadataRowModel[]) => {
        setUpdatedStudy((prevState) => {
            return {
                ...prevState,
                metadata: metadata,
            };
        });
        setSaveEnabled(true);
    };

    useEffect(() => {
        const getStudy = (id: string) => {
            API.Services.StudiesService.studiesIdGet(id, true)
                .then((res) => {
                    const study = res.data;
                    const metadataArr: IMetadataRowModel[] = study.metadata
                        ? Object.keys(study.metadata).map((row) => ({
                              metadataKey: row,
                              metadataValue: (study.metadata as any)[row],
                          }))
                        : [];
                    setInitialMetadataArr(metadataArr);

                    const analyses = (study.analyses as AnalysisApiResponse[]).sort((a, b) => {
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

                    setUpdatedStudy({
                        name: study.name || '',
                        authors: study.authors || '',
                        publication: study.publication || '',
                        doi: study.doi || '',
                        description: study.description || '',
                        metadata: metadataArr,
                        analyses: analyses,
                    });
                    if (study.analyses && study.analyses.length > 0) {
                        setSelectedAnalysis((prevState) => ({
                            analysis: (study.analyses as AnalysisApiResponse[])[
                                prevState.analysisIndex
                            ],
                            analysisIndex: prevState.analysisIndex,
                        }));
                    }
                })
                .catch(() => {});
        };

        if (params.studyId) {
            getStudy(params.studyId);
            setSaveEnabled(false);
        }
    }, [params.studyId, reload]);

    const handleOnCancel = (event: React.MouseEvent) => {
        history.push(`/studies/${params.studyId}`);
    };

    const handleOnSave = async (event: React.MouseEvent) => {
        const metadata = arrayToMetadata(updatedStudy?.metadata);
        try {
            const token = await getAccessTokenSilently();
            globalContext.handleToken(token);
        } catch (exception) {
            globalContext.showSnackbar('there was an error', SnackbarType.ERROR);
            console.log(exception);
        }

        API.Services.StudiesService.studiesIdPut(params.studyId, {
            name: updatedStudy.name,
            description: updatedStudy.description,
            authors: updatedStudy.authors,
            publication: updatedStudy.publication,
            doi: updatedStudy.doi,
            metadata: metadata,
            analyses: updatedStudy.analyses?.map((x) => ({
                id: x.id,
                name: x.name,
                description: x.description,
            })),
        })
            .then((res) => {
                globalContext.showSnackbar('study successfully updated', SnackbarType.SUCCESS);
                // trigger a reload by passing in a reference to an empty object
                setReload({});
            })
            .catch((err: Error | AxiosError) => {
                globalContext.showSnackbar('there was an error', SnackbarType.ERROR);
                console.log(err.message);
            });
    };

    const handleOnEdit = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setUpdatedStudy((prevState) => {
            return {
                ...prevState,
                [event.target.name]: event.target.value,
            };
        });
        setSaveEnabled(true);
    };

    const handleEditAnalysis = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setSelectedAnalysis((prevState) => {
            const analysis = prevState.analysis;
            switch (event.target.name) {
                case 'name':
                    (analysis as AnalysisApiResponse).name = event.target.value;
                    break;
                case 'description':
                    (analysis as AnalysisApiResponse).description = event.target.value;
                    break;
                default:
                    break;
            }
            return {
                ...prevState,
                analysis: analysis,
            };
        });
        setSaveEnabled(true);
    };

    return (
        <>
            <Box sx={EditStudyPageStyles.stickyButtonContainer}>
                <Button
                    onClick={handleOnSave}
                    disabled={!saveEnabled}
                    sx={{ ...EditStudyPageStyles.saveButton, ...EditStudyPageStyles.button }}
                    variant="outlined"
                >
                    Save Changes
                </Button>
                <Button
                    color="error"
                    onClick={handleOnCancel}
                    sx={EditStudyPageStyles.button}
                    variant="outlined"
                >
                    Cancel
                </Button>
            </Box>

            <Box sx={{ marginBottom: '15px', padding: '0 10px' }}>
                {updatedStudy && (
                    <Accordion elevation={4}>
                        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                            <Typography variant="h6">
                                <b>Edit Study Details</b>
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <TextField
                                label="Edit Title"
                                variant="outlined"
                                sx={EditStudyPageStyles.textfield}
                                value={updatedStudy.name}
                                InputProps={textFieldInputProps}
                                name="name"
                                onChange={handleOnEdit}
                            />
                            <TextField
                                sx={EditStudyPageStyles.textfield}
                                variant="outlined"
                                label="Edit Authors"
                                value={updatedStudy.authors}
                                InputProps={textFieldInputProps}
                                name="authors"
                                onChange={handleOnEdit}
                            />
                            <TextField
                                variant="outlined"
                                sx={EditStudyPageStyles.textfield}
                                label="Edit Journal"
                                value={updatedStudy.publication}
                                InputProps={textFieldInputProps}
                                name="publication"
                                onChange={handleOnEdit}
                            />
                            <TextField
                                variant="outlined"
                                sx={EditStudyPageStyles.textfield}
                                label="Edit DOI"
                                value={updatedStudy.doi}
                                InputProps={textFieldInputProps}
                                name="doi"
                                onChange={handleOnEdit}
                            />
                            <TextField
                                variant="outlined"
                                sx={EditStudyPageStyles.textfield}
                                label="Edit Description"
                                multiline
                                value={updatedStudy.description}
                                InputProps={textFieldInputProps}
                                name="description"
                                onChange={handleOnEdit}
                            />
                        </AccordionDetails>
                    </Accordion>
                )}
            </Box>

            <Box sx={{ marginBottom: '15px', padding: '0 10px' }}>
                <Accordion elevation={4}>
                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                        <Typography variant="h6">
                            <b>Edit Study Metadata</b>
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        {updatedStudy && (
                            <EditMetadata
                                onMetadataEditChange={handleMetadataEditChange}
                                metadata={initialMetadataArr}
                            />
                        )}
                    </AccordionDetails>
                </Accordion>
            </Box>

            <Box sx={{ marginBottom: '15px', padding: '0 10px', marginLeft: '15px' }}>
                <Typography variant="h6">
                    <b>Edit Analyses</b>
                </Typography>
                {updatedStudy.analyses && (
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
                                        analysis: (updatedStudy.analyses as AnalysisApiResponse[])[
                                            newVal
                                        ],
                                        analysisIndex: newVal,
                                    });
                                }}
                                orientation="vertical"
                                variant="scrollable"
                            >
                                {updatedStudy.analyses.map((analysis, index) => (
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
                                sx={EditStudyPageStyles.textfield}
                                variant="outlined"
                                label="Edit Analysis Name"
                                value={selectedAnalysis.analysis?.name || ''}
                                InputProps={textFieldInputProps}
                                name="name"
                                onChange={handleEditAnalysis}
                            />

                            <TextField
                                sx={EditStudyPageStyles.textfield}
                                variant="outlined"
                                label="Edit Analysis Description"
                                value={selectedAnalysis.analysis?.description || ''}
                                InputProps={textFieldInputProps}
                                name="description"
                                onChange={handleEditAnalysis}
                            />

                            <Box>
                                <Tabs
                                    scrollButtons
                                    sx={{
                                        borderBottom: 1,
                                        color: 'lightgray',
                                    }}
                                    TabScrollButtonProps={{
                                        sx: {
                                            color: 'primary.main',
                                        },
                                    }}
                                    value={0}
                                    variant="scrollable"
                                >
                                    <Tab value={0} label="Edit Coordinates"></Tab>
                                    <Tab value={1} label="Edit Conditions"></Tab>
                                    <Tab value={2} label="Edit Images"></Tab>
                                </Tabs>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>
        </>
    );
};

export default EditStudyPage;
