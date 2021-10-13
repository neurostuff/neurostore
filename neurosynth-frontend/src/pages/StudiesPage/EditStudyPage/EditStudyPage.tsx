import { useAuth0 } from '@auth0/auth0-react';
import { ExpandMoreOutlined } from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Button,
    TextField,
    Typography,
} from '@mui/material';
import { AxiosError } from 'axios';
import { useState, useEffect, ChangeEvent, useContext } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { EditMetadata, DisplayMetadataTableRowModel } from '../../../components';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import API from '../../../utils/api';
import EditStudyPageStyles from './EditStudyPageStyles';

interface IStudyEdit {
    name: string;
    authors: string;
    publication: string;
    doi: string;
    description: string;
    metadata: DisplayMetadataTableRowModel[];
}

const textFieldInputProps = {
    style: {
        fontSize: 15,
    },
};

const arrayToMetadata = (arr: DisplayMetadataTableRowModel[]): { [key: string]: any } => {
    const tempObj: { [key: string]: any } = {};
    arr.forEach((element) => (tempObj[element.metadataKey] = element.metadataValue));
    return tempObj;
};

const EditStudyPage = () => {
    const globalContext = useContext(GlobalContext);
    const { getAccessTokenSilently } = useAuth0();
    const classes = EditStudyPageStyles();
    const [saveEnabled, setSaveEnabled] = useState(false);

    // study and metadata edits are updated and stored in this state
    const [updatedStudy, setUpdatedStudy] = useState<IStudyEdit>({
        name: '',
        authors: '',
        publication: '',
        doi: '',
        description: '',
        metadata: [],
    });

    // initial metadata received from the study is set in this state. Separate in order to avoid constant re renders
    const [initialMetadataArr, setInitialMetadataArr] = useState<DisplayMetadataTableRowModel[]>(
        []
    );
    const history = useHistory();
    const params: { studyId: string } = useParams();

    const handleMetadataEditChange = (metadata: DisplayMetadataTableRowModel[]) => {
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
            API.Services.StudiesService.studiesIdGet(id)
                .then((res) => {
                    const study = res.data;
                    const metadataArr: DisplayMetadataTableRowModel[] = study.metadata
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
                    });
                })
                .catch(() => {});
        };

        if (params.studyId) {
            getStudy(params.studyId);
        }
    }, [params.studyId]);

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
        })
            .then((res) => {
                globalContext.showSnackbar('study successfully updated', SnackbarType.SUCCESS);
                history.push(`/studies/${params.studyId}`);
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

    return (
        <div style={{ height: '100%' }}>
            <div className={classes.stickyButtonContainer}>
                <Button
                    onClick={handleOnSave}
                    disabled={!saveEnabled}
                    className={`${classes.saveButton} ${classes.button}`}
                    variant="outlined"
                >
                    Save Changes
                </Button>
                <Button
                    color="error"
                    onClick={handleOnCancel}
                    className={`${classes.button}`}
                    variant="outlined"
                >
                    Cancel
                </Button>
            </div>

            <div style={{ marginBottom: '15px', padding: '0 10px' }}>
                {updatedStudy && (
                    <Accordion elevation={4}>
                        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                            <div>
                                <Typography variant="h6">
                                    <b>Study Details</b>
                                </Typography>
                            </div>
                        </AccordionSummary>
                        <AccordionDetails>
                            <TextField
                                style={{ width: '100%' }}
                                label="Edit Title"
                                variant="outlined"
                                className={classes.textfield}
                                value={updatedStudy.name}
                                InputProps={textFieldInputProps}
                                name="name"
                                onChange={handleOnEdit}
                            />
                            <TextField
                                style={{ width: '100%' }}
                                className={classes.textfield}
                                variant="outlined"
                                label="Edit Authors"
                                value={updatedStudy.authors}
                                InputProps={textFieldInputProps}
                                name="authors"
                                onChange={handleOnEdit}
                            />
                            <TextField
                                style={{ width: '100%' }}
                                variant="outlined"
                                className={classes.textfield}
                                label="Edit Journal"
                                value={updatedStudy.publication}
                                InputProps={textFieldInputProps}
                                name="publication"
                                onChange={handleOnEdit}
                            />
                            <TextField
                                style={{ width: '100%' }}
                                variant="outlined"
                                className={classes.textfield}
                                label="Edit DOI"
                                value={updatedStudy.doi}
                                InputProps={textFieldInputProps}
                                name="doi"
                                onChange={handleOnEdit}
                            />
                            <TextField
                                style={{ width: '100%' }}
                                variant="outlined"
                                className={classes.textfield}
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
            </div>

            <div style={{ marginBottom: '15px', padding: '0 10px' }}>
                <Accordion elevation={4}>
                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                        <div>
                            <Typography variant="h6">
                                <b>Metadata</b>
                            </Typography>
                        </div>
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
            </div>
        </div>
    );
};

export default EditStudyPage;
