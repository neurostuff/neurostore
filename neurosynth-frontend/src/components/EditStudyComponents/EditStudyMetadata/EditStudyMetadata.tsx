import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Typography,
    Button,
    Box,
} from '@mui/material';
import { ExpandMoreOutlined } from '@mui/icons-material';
import EditStudyMetadataStyles from './EditStudyMetadata.styles';
import { EditMetadata, IMetadataRowModel } from '../..';
import { useState, useContext, useEffect, useCallback } from 'react';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import { AxiosError } from 'axios';
import API from '../../../utils/api';
import { useAuth0 } from '@auth0/auth0-react';

export interface IEditStudyMetadata {
    studyId: string;
    metadata: any;
    onUpdateStudyMetadata: (metadata: any) => void;
}

const arrayToMetadata = (arr: IMetadataRowModel[]): { [key: string]: any } => {
    const tempObj: { [key: string]: any } = {};
    arr.forEach((element) => (tempObj[element.metadataKey] = element.metadataValue));
    return tempObj;
};

const EditStudyMetadata: React.FC<IEditStudyMetadata> = (props) => {
    const context = useContext(GlobalContext);
    const { getAccessTokenSilently } = useAuth0();
    const [updatedEnabled, setUpdateEnabled] = useState(false);
    const [metadataArr, setMetadataArr] = useState(props.metadata);

    useEffect(() => {
        // When we make our first GET request to /studies, metadata starts as undefined. Once metadataArr is defined as an array,
        // we know that we have received our res back, and we can show the metadata editor.
        if (props.metadata) {
            const metadataArr: IMetadataRowModel[] = props.metadata
                ? Object.keys(props.metadata).map((row) => ({
                      metadataKey: row,
                      metadataValue: props.metadata[row],
                  }))
                : [];

            setMetadataArr(metadataArr);
        }
    }, [props.metadata]);

    const handleMetadataEditChange = useCallback((metadata: IMetadataRowModel[]) => {
        setUpdateEnabled(true);
        setMetadataArr([...metadata]);
    }, []);

    const handleOnUpdate = async (event: React.MouseEvent) => {
        try {
            const token = await getAccessTokenSilently();
            context.handleToken(token);
        } catch (exception) {
            context.showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        const transformedMetadata = arrayToMetadata(metadataArr);

        API.Services.StudiesService.studiesIdPut(props.studyId, {
            metadata: transformedMetadata,
        })
            .then((res) => {
                setUpdateEnabled(false);
                context.showSnackbar('study successfully updated', SnackbarType.SUCCESS);
                props.onUpdateStudyMetadata(transformedMetadata);
            })
            .catch((err: Error | AxiosError) => {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(err.message);
            });
    };

    return (
        <Accordion elevation={2} sx={updatedEnabled ? EditStudyMetadataStyles.unsavedChanges : {}}>
            <AccordionSummary
                sx={EditStudyMetadataStyles.accordionSummary}
                expandIcon={<ExpandMoreOutlined />}
            >
                <Typography variant="h6">
                    <b>Edit Study Metadata</b>
                </Typography>
            </AccordionSummary>
            <AccordionDetails>
                {/* only show this component when metadataArr is not undefined or null */}
                {metadataArr && (
                    <EditMetadata
                        onMetadataEditChange={handleMetadataEditChange}
                        metadata={metadataArr}
                    />
                )}
                <Button
                    disabled={!updatedEnabled}
                    onClick={handleOnUpdate}
                    color="secondary"
                    variant="contained"
                    sx={EditStudyMetadataStyles.button}
                >
                    <b>Update Study Metadata</b>
                </Button>
            </AccordionDetails>
        </Accordion>
    );
};

export default EditStudyMetadata;
