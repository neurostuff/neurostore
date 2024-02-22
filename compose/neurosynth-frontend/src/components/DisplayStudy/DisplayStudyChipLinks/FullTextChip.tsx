import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Chip } from '@mui/material';
import { useGetFullText } from 'hooks';
import { useStudyName } from 'pages/Studies/StudyStore';
import { useEffect, useState } from 'react';
import DisplayStudyChipLinksStyles from './DisplayStudyChipLinks.styles';

let debounce: NodeJS.Timeout;

const FullTextChip: React.FC<{ name?: string | null }> = (props) => {
    const studyStoreName = useStudyName();
    const existingName = props.name || studyStoreName;
    useEffect(() => {
        debounce = setTimeout(() => {
            setDebouncedName(existingName || '');
        }, 500);

        return () => {
            setDebouncedName('');
            clearTimeout(debounce);
        };
    }, [existingName]);
    const [debouncedName, setDebouncedName] = useState('');

    const {
        data: fullTextURL,
        isLoading: getFullTextIsLoading,
        isError: getFullTextIsError,
    } = useGetFullText(debouncedName);

    if (getFullTextIsLoading || !debouncedName || getFullTextIsError || fullTextURL === '') {
        return <></>;
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
