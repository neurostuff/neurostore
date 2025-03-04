import { LinkProps, Tooltip } from '@mui/material';
import { useGetFullText } from 'hooks';
import { useEffect, useState } from 'react';
import DisplayLink from './DisplayLink';

let debounce: NodeJS.Timeout;

const DisplayStudyLinkFullText: React.FC<{ studyName: string } & LinkProps> = ({ studyName, ...linkProps }) => {
    useEffect(() => {
        debounce = setTimeout(() => {
            setDebouncedName(studyName || '');
        }, 500);

        return () => {
            setDebouncedName('');
            clearTimeout(debounce);
        };
    }, [studyName]);
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
                <>
                    <DisplayLink label="Full Text (PDF)" href={fullTextURL} {...linkProps} />
                </>
            </Tooltip>
        );
    }
};

export default DisplayStudyLinkFullText;
