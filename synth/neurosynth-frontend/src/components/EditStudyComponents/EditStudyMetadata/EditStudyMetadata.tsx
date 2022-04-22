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
import { EditMetadata, IMetadataRowModel, NeurosynthAccordion } from '../..';
import React, { useState, useContext, useCallback } from 'react';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import { AxiosError } from 'axios';
import API from '../../../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import useIsMounted from '../../../hooks/useIsMounted';

export interface IEditStudyMetadata {
    studyId: string;
    metadata: any;
    onUpdateStudyMetadata: (metadata: any) => void;
}

export const arrayToMetadata = (arr: IMetadataRowModel[]): { [key: string]: any } => {
    const tempObj: { [key: string]: any } = {};
    arr.forEach((element) => (tempObj[element.metadataKey] = element.metadataValue));
    return tempObj;
};

export const metadataToArray = (
    metadata: { [key: string]: any } | undefined
): IMetadataRowModel[] => {
    const transformedArr = metadata
        ? Object.keys(metadata).map((row) => ({
              metadataKey: row,
              metadataValue: metadata[row],
          }))
        : [];

    return transformedArr;
};

const EditStudyMetadata: React.FC<IEditStudyMetadata> = (props) => {
    const context = useContext(GlobalContext);
    const { getAccessTokenSilently } = useAuth0();
    const [updatedEnabled, setUpdateEnabled] = useState(false);
    const isMountedRef = useIsMounted();

    const [metadataArr, setMetadataArr] = useState<IMetadataRowModel[]>(
        metadataToArray(props.metadata)
    );

    const handleOnSave = async (event: React.MouseEvent) => {
        const transformedMetadata = arrayToMetadata(metadataArr);

        API.NeurostoreServices.StudiesService.studiesIdPut(props.studyId, {
            metadata: transformedMetadata,
        })
            .then((_res) => {
                context.showSnackbar('study successfully updated', SnackbarType.SUCCESS);
                props.onUpdateStudyMetadata(transformedMetadata);
                if (isMountedRef.current) setUpdateEnabled(false);
            })
            .catch((err: Error | AxiosError) => {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(err.message);
            });
    };

    const handleMetadataRowEdit = useCallback((updatedRow: IMetadataRowModel) => {
        setMetadataArr((prevState) => {
            const updatedMetadata = [...prevState];
            const valueToEditIndexFound = updatedMetadata.findIndex(
                (x) => x.metadataKey === updatedRow.metadataKey
            );
            if (valueToEditIndexFound < 0) return { ...prevState };
            updatedMetadata[valueToEditIndexFound] = {
                ...updatedMetadata[valueToEditIndexFound],
                metadataValue: updatedRow.metadataValue,
            };
            setUpdateEnabled(true);
            return updatedMetadata;
        });
    }, []);

    const handleMetadataRowDelete = useCallback((updatedRow: IMetadataRowModel) => {
        setMetadataArr((prevState) => {
            // filter returns a new copy of the array
            const updatedMetadata = prevState.filter(
                (element) => element.metadataKey !== updatedRow.metadataKey
            );
            setUpdateEnabled(true);
            return updatedMetadata;
        });
    }, []);

    const handleMetadataRowAdd = useCallback(
        (row: IMetadataRowModel): boolean => {
            const keyExists = !!metadataArr.find((item) => item.metadataKey === row.metadataKey);
            if (keyExists) {
                return false;
            } else {
                setMetadataArr((prevState) => {
                    const updatedState = [...prevState];
                    updatedState.unshift({ ...row });
                    setUpdateEnabled(true);
                    return updatedState;
                });
                return true;
            }
        },
        [metadataArr]
    );

    const handleRevertChanges = (event: React.MouseEvent) => {
        const tempRevertedChanges = metadataToArray(props.metadata);
        setMetadataArr(tempRevertedChanges);
        setUpdateEnabled(false);
    };

    return (
        <NeurosynthAccordion
            TitleElement={
                <Box sx={EditStudyMetadataStyles.accordionTitleContainer}>
                    <Typography variant="h6">
                        <b>Edit Study Metadata</b>
                    </Typography>
                    {updatedEnabled && (
                        <Typography color="secondary" variant="body2">
                            unsaved changes
                        </Typography>
                    )}
                </Box>
            }
            accordionSummarySx={EditStudyMetadataStyles.accordionSummary}
            elevation={2}
            sx={updatedEnabled ? EditStudyMetadataStyles.unsavedChanges : {}}
        >
            {/* only show this component when metadataArr is not undefined or null */}
            {metadataArr && (
                <EditMetadata
                    onMetadataRowAdd={handleMetadataRowAdd}
                    onMetadataRowEdit={handleMetadataRowEdit}
                    onMetadataRowDelete={handleMetadataRowDelete}
                    metadata={metadataArr}
                />
            )}
            <Button
                disabled={!updatedEnabled}
                onClick={handleOnSave}
                color="success"
                variant="contained"
                sx={{ ...EditStudyMetadataStyles.button, marginRight: '15px' }}
            >
                Save
            </Button>
            <Button
                disabled={!updatedEnabled}
                color="secondary"
                variant="outlined"
                onClick={handleRevertChanges}
                sx={EditStudyMetadataStyles.button}
            >
                Cancel
            </Button>
        </NeurosynthAccordion>
    );
};

export default EditStudyMetadata;
