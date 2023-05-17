import { Box, Button, Typography } from '@mui/material';
import Ingestion from 'components/ExtractionComponents/Ingestion/Ingestion';
import { useProjectExtractionStudysetId } from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import { useQueryClient } from 'react-query';
import BaseDialog, { IDialog } from '../BaseDialog';

const ExtractionReconcile: React.FC<IDialog> = (props) => {
    const studysetId = useProjectExtractionStudysetId();
    const queryClient = useQueryClient();
    const [isReconciling, setIsReconciling] = useState(false);

    const handleComplete = () => {
        queryClient.invalidateQueries(['studysets', studysetId]);
        props.onCloseDialog();
    };

    return (
        <BaseDialog
            isOpen={props.isOpen}
            onCloseDialog={props.onCloseDialog}
            dialogTitle="Resolve Curation and Extraction Discrepancies"
        >
            <Box>
                {isReconciling ? (
                    <Ingestion onComplete={handleComplete} />
                ) : (
                    <Box>
                        <Typography>
                            A studyset contains studies that have been selected/included as a direct
                            result of the curation phase.
                        </Typography>
                        <Typography>
                            If there is a mismatch between the included studies in the curation
                            phase and the studies in the studyset, neurosynth compose will initiate
                            a reconciliation process.
                        </Typography>
                        <Typography>
                            Neurosynth compose will remove all studies in the studyset that do not
                            exist within the included curation studies list, and it will go through
                            the ingestion process again for any included studies in the curation
                            phase that are not found in the studyset.
                        </Typography>
                        <Typography>
                            Note: While we suggest keeping the studyset in the extraction phase in
                            sync with the included studies from the curation phase for the sake of
                            provenance, this is not strictly required to complete a meta-analysis.
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                onClick={() => setIsReconciling(true)}
                                sx={{ marginTop: '1rem' }}
                                variant="contained"
                            >
                                begin reconciliation
                            </Button>
                        </Box>
                    </Box>
                )}
            </Box>
        </BaseDialog>
    );
};

export default ExtractionReconcile;
