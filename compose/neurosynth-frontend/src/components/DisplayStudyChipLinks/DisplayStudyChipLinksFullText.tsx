import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Chip, Tooltip } from '@mui/material';
import { useGetFullText } from 'hooks';
import { useStudyName } from 'pages/Study/store/StudyStore';
import { useEffect, useState } from 'react';
import DisplayStudyChipLinksStyles from './DisplayStudyChipLinks.styles';

let debounce: NodeJS.Timeout;

const DisplayStudyChipLinksFullText: React.FC<{ name?: string | null }> = (props) => {
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
            <Tooltip placement="top" title="View the full article in PDF form via Semantic Scholar">
                <Chip
                    icon={<OpenInNewIcon />}
                    color="primary"
                    label="full text (PDF)"
                    component="a"
                    href={fullTextURL}
                    target="_blank"
                    rel="noreferrer"
                    clickable
                    sx={DisplayStudyChipLinksStyles.chip}
                    variant="outlined"
                />
            </Tooltip>
        );
    }
};

export default DisplayStudyChipLinksFullText;
