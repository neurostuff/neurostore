import { Typography, Button, Box } from '@mui/material';
import EditStudyMetadataStyles from './EditStudyMetadata.styles';
import EditMetadata from 'components/EditMetadata/EditMetadata';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import { IMetadataRowModel } from 'components/EditMetadata';
import React, { useState, useCallback, useEffect } from 'react';
import { useUpdateStudy } from 'hooks';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';

export interface IEditStudyMetadata {
    studyId: string;
    metadata: any;
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

export const sortMetadataArrayFn = (a: string, b: string) => {
    const lowerCaseA = a.toLocaleLowerCase();
    const lowerCaseB = b.toLocaleLowerCase();

    return lowerCaseA < lowerCaseB ? -1 : lowerCaseA > lowerCaseB ? 1 : 0;
};

const EditStudyMetadata: React.FC<IEditStudyMetadata> = (props) => {
    const { isLoading, mutate } = useUpdateStudy();
    const [updatedEnabled, setUpdateEnabled] = useState(false);

    const [metadataArr, setMetadataArr] = useState<IMetadataRowModel[]>([]);

    // we dont need to update the UI as the parent component will always be in sync.
    // save is the only action that updates the metadata, and that will reflect what is already shown on the page
    useEffect(() => {
        if (props.metadata) {
            const metadataArray = metadataToArray(props.metadata).sort((a, b) =>
                sortMetadataArrayFn(a.metadataKey, b.metadataKey)
            );
            setMetadataArr(metadataArray);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOnSave = () => {
        const transformedMetadata = arrayToMetadata(metadataArr);
        mutate(
            {
                studyId: props.studyId,
                study: {
                    metadata: transformedMetadata,
                },
            },
            {
                onSuccess: () => {
                    setUpdateEnabled(false);
                },
            }
        );
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
            return updatedMetadata;
        });
        setUpdateEnabled(true);
    }, []);

    const handleMetadataRowAdd = useCallback(
        (row: IMetadataRowModel): boolean => {
            const keyExists = !!metadataArr.find((item) => item.metadataKey === row.metadataKey);
            if (keyExists) {
                return false;
            } else {
                setMetadataArr((prevState) => {
                    const updatedState = [{ ...row }, ...prevState];
                    return updatedState;
                });
                setUpdateEnabled(true);
                return true;
            }
        },
        [metadataArr]
    );

    const handleRevertChanges = (event: React.MouseEvent) => {
        const tempRevertedChanges = metadataToArray(props.metadata).sort((a, b) =>
            sortMetadataArrayFn(a.metadataKey, b.metadataKey)
        );
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
            <LoadingButton
                disabled={!updatedEnabled}
                onClick={handleOnSave}
                isLoading={isLoading}
                color="success"
                text="Save"
                variant="contained"
                sx={{ ...EditStudyMetadataStyles.button, marginRight: '15px' }}
            />
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
