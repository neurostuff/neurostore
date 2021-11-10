import { useAuth0 } from '@auth0/auth0-react';
import { ExpandMoreOutlined } from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    TextField,
    Typography,
} from '@mui/material';
import { AxiosError } from 'axios';
import { useState, useEffect, ChangeEvent, useContext } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { EditMetadata, IMetadataRowModel, EditAnalyses } from '../../../components';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
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

                    setUpdatedStudy({
                        name: study.name || '',
                        authors: study.authors || '',
                        publication: study.publication || '',
                        doi: study.doi || '',
                        description: study.description || '',
                        metadata: metadataArr,
                        analyses: study.analyses as AnalysisApiResponse[] | undefined,
                    });
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

    const handleEditAnalyses = (editedAnalyses: AnalysisApiResponse[]) => {
        setSaveEnabled(true);
        // setSelectedAnalysis((prevState) => {
        //     const analysis = prevState.analysis;
        //     switch (event.target.name) {
        //         case 'name':
        //             (analysis as AnalysisApiResponse).name = event.target.value;
        //             break;
        //         case 'description':
        //             (analysis as AnalysisApiResponse).description = event.target.value;
        //             break;
        //         default:
        //             break;
        //     }
        //     return {
        //         ...prevState,
        //         analysis: analysis,
        //     };
        // });
        // setSaveEnabled(true);
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
                <EditAnalyses
                    onEditAnalyses={handleEditAnalyses}
                    analyses={updatedStudy.analyses}
                />
            </Box>
        </>
    );
};

export default EditStudyPage;
