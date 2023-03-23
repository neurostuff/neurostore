import { Typography, Box, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import EditMetadata from 'components/EditMetadata/EditMetadata';
import { IMetadataRowModel } from 'components/EditMetadata';
import React, { useCallback } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    useAddOrUpdateMetadata,
    useDeleteMetadataRow,
    useStudyMetadata,
} from 'pages/Studies/StudyStore';

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
        <Accordion elevation={0}>
            <AccordionSummary
                sx={{ ':hover': { backgroundColor: '#f7f7f7' } }}
                expandIcon={<ExpandMoreIcon />}
            >
                <Typography sx={{ fontWeight: 'bold' }}>Study Metadata</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Box>
                    <EditMetadata
                        onMetadataRowAdd={handleMetadataRowAdd}
                        onMetadataRowEdit={handleMetadataRowEdit}
                        onMetadataRowDelete={handleMetadataRowDelete}
                        metadata={metadata}
                    />
                </Box>
            </AccordionDetails>
        </Accordion>
    );
};

export default EditStudyMetadata;
