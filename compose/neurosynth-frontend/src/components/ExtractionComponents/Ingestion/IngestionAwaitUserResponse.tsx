import { Box, Button, Link, Typography } from '@mui/material';
import CurationImportStubSummary from 'components/CurationComponents/CurationImport/CurationImportStubSummary';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { StudyReturn } from 'neurostore-typescript-sdk';

const IngestionAwaitUserResponse: React.FC<{
    currentIngestionIndex: number;
    totalToIngest: number;
    stubBeingIngested: ICurationStubStudy;
    existingMatchingStudies: StudyReturn[];
    onSelectOption: (option: ICurationStubStudy | StudyReturn, isStudy: boolean) => void;
}> = (props) => {
    const {
        currentIngestionIndex,
        totalToIngest,
        stubBeingIngested,
        existingMatchingStudies,
        onSelectOption,
    } = props;

    return (
        <Box>
            <Box>
                <Typography sx={{ textAlign: 'center' }} gutterBottom variant="h5">
                    Ingesting {`${(currentIngestionIndex || 0) + 1} / ${totalToIngest}`}
                </Typography>
                <Typography>
                    We encountered a study that exists in neurostore already. You can choose whether
                    to ignore the existing study and ingest anyway, or select the existing study to
                    add to your studyset instead.
                </Typography>
            </Box>
            <Box sx={{ marginTop: '1rem' }}>
                <Typography variant="h6">Your Study</Typography>
                {stubBeingIngested && (
                    <Box
                        sx={{
                            backgroundColor: '#f3f3f3',
                            borderRadius: '8px',
                            padding: '10px',
                        }}
                    >
                        <CurationImportStubSummary {...stubBeingIngested} />
                        <Button
                            onClick={() => onSelectOption(stubBeingIngested, false)}
                            color="success"
                            variant="contained"
                            size="small"
                            disableElevation
                        >
                            Ignore existing studies and ingest
                        </Button>
                    </Box>
                )}
            </Box>
            <Box sx={{ marginTop: '2rem' }}>
                <Typography variant="h6" gutterBottom sx={{ marginBottom: '0.5rem' }}>
                    Existing Studies in the database (click the title to view in neurostore)
                </Typography>
                {(existingMatchingStudies || []).map((study, index) => (
                    <Box
                        key={study.id || index}
                        sx={{
                            backgroundColor: '#f3f3f3',
                            borderRadius: '8px',
                            padding: '10px',
                            marginBottom: '1.5rem',
                        }}
                    >
                        <Link
                            sx={{ fontSize: '1.25rem' }}
                            rel="noopener"
                            underline="hover"
                            color="primary"
                            target="_blank"
                            href={`http://localhost:3000/studies/${study.id}`}
                        >
                            {study.name}
                        </Link>
                        <Button
                            onClick={() => onSelectOption(study, true)}
                            sx={{ marginTop: '0.5rem', display: 'block' }}
                            size="small"
                            color="success"
                            variant="contained"
                            disableElevation
                        >
                            Add this study to your studyset
                        </Button>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default IngestionAwaitUserResponse;
