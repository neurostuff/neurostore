import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Chip, Link, Tooltip } from '@mui/material';
import { useGetFullText } from 'hooks';
import { useStudyName } from 'pages/Study/store/StudyStore';
import { useEffect, useState } from 'react';
import DisplayStudyLinksStyles from './DisplayStudyLinks.styles';

let debounce: NodeJS.Timeout;

const DisplayStudyLinksFullText: React.FC<{ name?: string | null }> = (props) => {
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

    if (
        getFullTextIsLoading ||
        !debouncedName ||
        getFullTextIsError ||
        fullTextURL === '' ||
        fullTextURL === undefined
    ) {
        return <></>;
    } else {
        return (
            <Tooltip placement="top" title="View the full article in PDF form via Semantic Scholar">
                <Link
                    color="primary"
                    href={fullTextURL}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    sx={DisplayStudyLinksStyles.link}
                >
                    full text (PDF)
                    <OpenInNewIcon sx={{ marginLeft: '4px' }} fontSize="small" />
                </Link>
            </Tooltip>
        );
    }
};

export default DisplayStudyLinksFullText;
