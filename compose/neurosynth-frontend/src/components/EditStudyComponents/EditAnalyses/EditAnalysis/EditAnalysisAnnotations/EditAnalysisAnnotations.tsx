import Box from '@mui/material/Box';
import EditMetadata from 'components/EditMetadata/EditMetadata';

const EditAnalysisAnnotations: React.FC = (props) => {
    return (
        <Box>
            <EditMetadata
                onMetadataRowAdd={(x: any) => false}
                onMetadataRowEdit={(x: any) => {}}
                onMetadataRowDelete={(x: any) => {}}
                metadata={[
                    { metadataKey: 'included (default)', metadataValue: true },
                    { metadataKey: 'numSubjects', metadataValue: 213 },
                    { metadataKey: 'methodology', metadataValue: '' },
                ]}
            />
        </Box>
    );
};

export default EditAnalysisAnnotations;
