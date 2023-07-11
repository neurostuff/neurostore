import { Box, TextField } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ChangeEvent } from 'react';

const CreateMetaAnalysisSpecificationDetailsStep: React.FC<{
    details: { name: string; description: string };
    onUpdateDetails: (details: { name: string; description: string }) => void;
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const handleUpdateDetails = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        props.onUpdateDetails({
            ...props.details,
            [event.target.name]: event.target.value,
        });
    };

    return (
        <Box>
            <TextField
                sx={{ marginBottom: '1rem' }}
                fullWidth
                value={props.details.name}
                label="name"
                name="name"
                onChange={handleUpdateDetails}
            />
            <TextField
                value={props.details.description}
                sx={{ marginBottom: '1rem' }}
                fullWidth
                onChange={handleUpdateDetails}
                label="description"
                name="description"
            />
            <NavigationButtons
                prevButtonDisabled
                onButtonClick={props.onNavigate}
                nextButtonStyle="contained"
                nextButtonDisabled={!props.details.name}
            />
        </Box>
    );
};

export default CreateMetaAnalysisSpecificationDetailsStep;
