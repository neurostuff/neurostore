import { HotTable } from '@handsontable/react';
import { Box, Paper } from '@mui/material';
import { useGetAnnotationById } from 'hooks';
import EditAnnotationsPageStyles from 'pages/Annotations/EditAnnotationsPage/EditAnnotationsPage.styles';
import { useProjectExtractionAnnotationId } from 'pages/Projects/ProjectPage/ProjectStore';

const EditAnnotations: React.FC = (props) => {
    const annotationId = useProjectExtractionAnnotationId();
    const { data: annotation } = useGetAnnotationById(annotationId);
    console.log(annotation);
    return (
        <div>
            <Box component={Paper} sx={EditAnnotationsPageStyles.spreadsheetContainer}>
                <HotTable licenseKey="non-commercial-and-evaluation" />
            </Box>
        </div>
    );
};

export default EditAnnotations;
