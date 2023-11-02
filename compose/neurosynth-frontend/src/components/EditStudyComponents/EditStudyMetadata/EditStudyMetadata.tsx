import { Typography, Box } from '@mui/material';
import EditMetadata from 'components/EditMetadata/EditMetadata';
import { IMetadataRowModel } from 'components/EditMetadata';
import React, { useCallback } from 'react';
import {
    useAddOrUpdateMetadata,
    useDeleteMetadataRow,
    useStudyMetadata,
} from 'pages/Studies/StudyStore';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import EditStudyComponentsStyles from 'components/EditStudyComponents/EditStudyComponents.styles';

export interface IEditStudyMetadata {
    studyId: string;
    metadata: IMetadataRowModel[];
}

export const arrayToMetadata = (arr: IMetadataRowModel[]): { [key: string]: any } => {
    const tempObj: { [key: string]: any } = {};
    arr.forEach((element) => (tempObj[element.metadataKey] = element.metadataValue));
    return tempObj;
};

export const metadataToArray = (metadata: object | undefined): IMetadataRowModel[] => {
    const transformedArr = metadata
        ? Object.keys(metadata).map((key) => ({
              metadataKey: key,
              metadataValue: (metadata as unknown as { [key: string]: any })[key],
          }))
        : [];

    if (!('sample_size' in (metadata || {}))) {
        transformedArr.unshift({
            metadataKey: 'sample_size',
            metadataValue: null,
        });
    }

    return transformedArr;
};

export const sortMetadataArrayFn = (a: string, b: string) => {
    const lowerCaseA = a.toLocaleLowerCase();
    const lowerCaseB = b.toLocaleLowerCase();

    return lowerCaseA < lowerCaseB ? -1 : lowerCaseA > lowerCaseB ? 1 : 0;
};

const EditStudyMetadata: React.FC = (props) => {
    const metadata = useStudyMetadata();
    const addOrUpdateMetadata = useAddOrUpdateMetadata();
    const deleteMetadataRow = useDeleteMetadataRow();

    const handleMetadataRowEdit = useCallback(
        (updatedRow: IMetadataRowModel) => {
            addOrUpdateMetadata(updatedRow);
        },
        [addOrUpdateMetadata]
    );

    const handleMetadataRowDelete = useCallback(
        (updatedRow: IMetadataRowModel) => {
            deleteMetadataRow(updatedRow.metadataKey);
        },
        [deleteMetadataRow]
    );

    const handleMetadataRowAdd = useCallback(
        (row: IMetadataRowModel): boolean => {
            const foundIndex = metadata.findIndex((x) => x.metadataKey === row.metadataKey);
            if (foundIndex < 0) {
                addOrUpdateMetadata(row);
                return true;
            }
            return false;
        },
        [addOrUpdateMetadata, metadata]
    );

    return (
        <NeurosynthAccordion
            elevation={0}
            expandIconColor="secondary.main"
            sx={EditStudyComponentsStyles.accordion}
            accordionSummarySx={EditStudyComponentsStyles.accordionSummary}
            TitleElement={
                <Typography sx={EditStudyComponentsStyles.accordionTitle}>Metadata</Typography>
            }
        >
            <Box sx={{ margin: '1rem 0 0.5rem 0' }}>
                <EditMetadata
                    onMetadataRowAdd={handleMetadataRowAdd}
                    onMetadataRowEdit={handleMetadataRowEdit}
                    onMetadataRowDelete={handleMetadataRowDelete}
                    metadata={metadata}
                />
            </Box>
        </NeurosynthAccordion>
    );
};

export default EditStudyMetadata;
