import { Typography, Button, Box } from '@mui/material';
import EditStudyMetadataStyles from './EditStudyMetadata.styles';
import EditMetadata from 'components/EditMetadata/EditMetadata';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import { IMetadataRowModel } from 'components/EditMetadata';
import React, { useState, useCallback } from 'react';
import { AxiosError } from 'axios';
import API from 'utils/api';
import useIsMounted from 'hooks/useIsMounted';
import { useSnackbar } from 'notistack';

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
    const { enqueueSnackbar } = useSnackbar();
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
                enqueueSnackbar('study updated successfully', { variant: 'success' });
                props.onUpdateStudyMetadata(transformedMetadata);
                if (isMountedRef.current) setUpdateEnabled(false);
            })
            .catch((err: Error | AxiosError) => {
                enqueueSnackbar('there was an error updating the study', { variant: 'error' });
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
