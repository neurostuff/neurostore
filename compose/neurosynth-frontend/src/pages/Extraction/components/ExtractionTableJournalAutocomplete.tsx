import { Autocomplete, Box, TextField } from '@mui/material';
import { useGetStudysetById } from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { useProjectExtractionStudysetId } from 'pages/Project/store/ProjectStore';
import { useMemo } from 'react';

const ExtractionTableJournalAutocomplete: React.FC<{
    value: string;
    onChange: (value: string | null) => void;
}> = ({ value, onChange }) => {
    const studysetId = useProjectExtractionStudysetId();
    const { data: studyset } = useGetStudysetById(studysetId, false, true);

    const options = useMemo(() => {
        if (!studyset) return [];
        const journalsSet = new Set<string>();
        (studyset.studies || []).forEach((study) => {
            if ((study as StudyReturn)?.publication) {
                journalsSet.add((study as StudyReturn)?.publication || '');
            }
        });

        return Array.from(journalsSet).sort();
    }, [studyset]);

    const handleChange = (event: any, value: string | null) => {
        onChange(value);
    };

    return (
        <Box sx={{ marginTop: '4px' }}>
            <Autocomplete
                size="small"
                renderInput={(params) => <TextField {...params} placeholder="filter" />}
                onChange={handleChange}
                value={value || null}
                options={options}
            />
        </Box>
    );
};

export default ExtractionTableJournalAutocomplete;
