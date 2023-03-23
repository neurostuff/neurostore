import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Typography,
    Box,
    Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DataGrid, GridColumns } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import { useAnnotation } from 'pages/Studies/StudyStore';
import NeurosynthNoRowsOverlay from './NeurosynthNoRowsOverlay';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';

const EditAnalysisAnnotations: React.FC = (props) => {
    const annotation = useAnnotation();
    const dynamicColumns: GridColumns<any> = annotation.note_keys.map((noteKey) => ({
        field: noteKey.key,
        editable: true,
        type: noteKey.type,
        flex: 1,
    }));
    const columns: GridColumns<any> = [
        { field: 'analysis', headerName: 'Analysis', editable: false, flex: 1 },
        ...dynamicColumns,
        // annotation.note_keys.
        // { '' }
    ];

    const rows = ((annotation.notes || []) as NoteCollectionReturn[]).map((annotationNote) => ({
        analysis: annotationNote.analysis,
        ...(annotationNote.note || {}),
    }));

    const handleRowUpdate = (newRow: any, oldRow: any) => {};

    return (
        <Accordion elevation={0}>
            <AccordionSummary
                sx={{ ':hover': { backgroundColor: '#f7f7f7' } }}
                expandIcon={<ExpandMoreIcon />}
            >
                <Typography sx={{ fontWeight: 'bold' }}>Study Annotations</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginBottom: '1rem',
                    }}
                >
                    <Button variant="outlined" sx={{ width: '150px' }} startIcon={<Add />}>
                        Annotation
                    </Button>
                </Box>
                <Box sx={{ height: `${56 + (rows.length + 1) * 52}px` }}>
                    <DataGrid
                        processRowUpdate={handleRowUpdate}
                        components={{
                            NoRowsOverlay: NeurosynthNoRowsOverlay,
                        }}
                        rows={rows}
                        columns={columns}
                        hideFooter
                    />
                </Box>
            </AccordionDetails>
        </Accordion>
    );
};

export default EditAnalysisAnnotations;
