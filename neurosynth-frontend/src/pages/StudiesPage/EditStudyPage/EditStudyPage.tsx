import { useAuth0 } from '@auth0/auth0-react';
import { ExpandMoreOutlined } from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Typography,
} from '@mui/material';
import { AxiosError } from 'axios';
import { useState, useEffect, useContext, useCallback } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
    EditMetadata,
    IMetadataRowModel,
    EditAnalyses,
    EditStudyDetails,
} from '../../../components';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import API, { AnalysisApiResponse } from '../../../utils/api';
import EditStudyPageStyles from './EditStudyPage.styles';

interface IStudyEdit {
    name: string;
    authors: string;
    publication: string;
    doi: string;
    description: string;
    metadata: IMetadataRowModel[];
    analyses: AnalysisApiResponse[] | undefined;
}

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

    const handleMetadataEditChange = useCallback((metadata: IMetadataRowModel[]) => {
        setUpdatedStudy((prevState) => {
            return {
                ...prevState,
                metadata: metadata,
            };
        });
        setSaveEnabled(true);
    }, []);

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

    const handleOnEdit = useCallback((arg: { key: string; value: string }) => {
        setUpdatedStudy((prevState) => {
            return {
                ...prevState,
                [arg.key]: arg.value,
            };
        });
        setSaveEnabled(true);
    }, []);

    // idToUpdate: string, update: { key: string, value: string }
    const handleEditAnalysisDetails = useCallback(
        (idToUpdate: string | undefined, update: { key: string; value: string }) => {
            setSaveEnabled(true);
            setUpdatedStudy((prevState) => {
                if (prevState.analyses === undefined) return { ...prevState };

                // set new ref to array and object for react to detect
                const newAnalyses = [...prevState.analyses];
                const analysisIndexToUpdate = newAnalyses.findIndex(
                    (analysis) => analysis.id === idToUpdate
                );
                if (analysisIndexToUpdate < 0) return { ...prevState };
                newAnalyses[analysisIndexToUpdate] = {
                    ...newAnalyses[analysisIndexToUpdate],
                    [update.key]: update.value,
                };

                return {
                    ...prevState,
                    analyses: newAnalyses,
                };
            });
        },
        []
    );

    const handleEditAnalysisImages = useCallback(() => {}, []);

    // idToUpdate: string
    const handleEditAnalysisPoints = useCallback(() => {}, []);

    return (
        <>
            <Box sx={EditStudyPageStyles.stickyButtonContainer}>
                <Button
                    onClick={handleOnSave}
                    color="success"
                    disabled={!saveEnabled}
                    sx={{ ...EditStudyPageStyles.saveButton, ...EditStudyPageStyles.button }}
                    variant="contained"
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
                            <EditStudyDetails
                                onEdit={handleOnEdit}
                                name={updatedStudy.name}
                                description={updatedStudy.description}
                                authors={updatedStudy.authors}
                                doi={updatedStudy.doi}
                                publication={updatedStudy.publication}
                            />
                        </AccordionDetails>
                    </Accordion>
                )}
            </Box>

            <Box sx={{ marginBottom: '30px', padding: '0 10px' }}>
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
                    onEditAnalysisDetails={handleEditAnalysisDetails}
                    onEditAnalysisImages={handleEditAnalysisImages}
                    onEditAnalysisPoints={handleEditAnalysisPoints}
                    analyses={updatedStudy.analyses}
                />
            </Box>
        </>
    );
};

export default EditStudyPage;
