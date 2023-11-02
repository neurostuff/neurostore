import { Box, Chip, Typography } from '@mui/material';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import useGetFullText from 'hooks/external/useGetFullText';
import { useStudyName } from 'pages/Studies/StudyStore';
import { useEffect, useState } from 'react';
import DisplayStudyChipLinksStyles from './DisplayStudyChipLinks.styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

let debounce: NodeJS.Timeout;

const FullTextChip: React.FC<{ name?: string | null }> = (props) => {
    const studyStoreName = useStudyName();
    const existingName = props.name || studyStoreName;
    useEffect(() => {
        debounce = setTimeout(() => {
            setDebouncedName(existingName || '');
        }, 1000);

        return () => {
            clearTimeout(debounce);
        };
    }, [existingName]);
    const [debouncedName, setDebouncedName] = useState('');

    const {
        data: fullTextURL,
        isLoading: getFullTextIsLoading,
        isError: getFullTextIsError,
    } = useGetFullText(debouncedName);

    console.log({
        debouncedName,
        getFullTextIsError,
        getFullTextIsLoading,
        fullTextURL,
    });

    if (getFullTextIsLoading || !debouncedName) {
        return (
            <Box sx={{ display: 'inline-block', textAlign: 'center', width: '200px' }}>
                <ProgressLoader sx={{ marginRight: '15px' }} size={20} />
                <Typography variant="caption">Searching for full text</Typography>
            </Box>
        );
    } else if (getFullTextIsError) {
        return (
            <Typography variant="caption" sx={{ color: 'error.main', display: 'inline' }}>
                There was an error trying to retrieve the full text
            </Typography>
        );
    } else if (fullTextURL === '') {
        return (
            <Typography variant="caption" sx={{ display: 'inline', color: 'warning.dark' }}>
                No full text found
            </Typography>
        );
    } else {
        return (
            <Chip
                icon={<OpenInNewIcon />}
                color="primary"
                label="Full Text"
                component="a"
                href={fullTextURL}
                target="_blank"
                clickable
                sx={DisplayStudyChipLinksStyles.chip}
                variant="outlined"
            />
        );
    }
};

export default FullTextChip;
