import { Box, TextField } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { useGetMetaAnalysesByProjectId } from 'hooks';
import { useProjectName } from 'pages/Projects/ProjectPage/ProjectStore';
import { ChangeEvent, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const CreateMetaAnalysisSpecificationDetailsStep: React.FC<{
    details: { name: string; description: string };
    selectionKey: string | undefined;
    algorithmName: string | undefined;
    correctorName: string | undefined;
    onUpdateDetails: (details: { name: string; description: string }) => void;
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const { data } = useGetMetaAnalysesByProjectId(projectId);
    const { details, selectionKey, algorithmName, correctorName, onUpdateDetails, onNavigate } =
        props;
    const projectName = useProjectName();

    const handleUpdateDetails = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onUpdateDetails({
            ...details,
            [event.target.name]: event.target.value,
        });
    };

    useEffect(() => {
        const originalName = `${projectName || ''} ${algorithmName} Meta Analysis: ${selectionKey}`;

        let numStr = '';
        for (let i = 0; i < (data || []).length; i++) {
            const hasDuplicateName = data?.find(
                // eslint-disable-next-line no-loop-func
                (x) =>
                    (x.name || '').toLocaleLowerCase() ===
                    `${originalName}${numStr}`.toLocaleLowerCase()
            );
            if (hasDuplicateName) {
                numStr = ` (${i + 1})`;
            } else {
                break;
            }
        }

        const name = `${originalName}${numStr}`;

        const correctorStr = `${correctorName ? ` with ${correctorName}` : ''}`;
        const description = `${algorithmName} meta analysis${correctorStr}`;

        onUpdateDetails({
            ...details,
            name: name,
            description: description,
        });
        // only want this to run once initially
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Box>
            <TextField
                sx={{ marginBottom: '1rem' }}
                fullWidth
                value={details.name}
                label="name"
                name="name"
                onChange={handleUpdateDetails}
            />
            <TextField
                value={details.description}
                sx={{ marginBottom: '1rem' }}
                fullWidth
                onChange={handleUpdateDetails}
                label="description"
                name="description"
            />
            <NavigationButtons
                onButtonClick={onNavigate}
                nextButtonStyle="contained"
                nextButtonDisabled={!details.name}
            />
        </Box>
    );
};

export default CreateMetaAnalysisSpecificationDetailsStep;
