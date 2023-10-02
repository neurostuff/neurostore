import { Box, Chip } from '@mui/material';
import useGetFullText from 'hooks/external/useGetFullText';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { PUBMED_ARTICLE_URL_PREFIX } from 'hooks/external/useGetPubMedIds';
import DisplayStudyChipLinksStyles from './DisplayStudyChipLinks.styles';
import { useStudyDOI, useStudyName, useStudyPMID } from 'pages/Studies/StudyStore';
import { useEffect, useState } from 'react';

let debounce: NodeJS.Timeout;

const DisplayStudyChipLinks: React.FC<{
    studyName?: string | null;
    pmid?: string | null;
    doi?: string | null;
}> = (props) => {
    const studyStoreName = useStudyName();
    const studyStorePMID = useStudyPMID();
    const studyStoreDOI = useStudyDOI();

    const { studyName, pmid, doi } = props;

    const existingName = studyName || studyStoreName;
    const existingPMID = pmid || studyStorePMID;
    const existing = doi || studyStoreDOI;

    useEffect(() => {
        debounce = setTimeout(() => {
            setName(existingName || '');
        }, 5000);

        return () => {
            clearTimeout(debounce);
        };
    }, [existingName]);
    const [name, setName] = useState('');

    const { data: fullTextURL, isLoading, isError } = useGetFullText(name);
    const hasFullText = !!fullTextURL && !isLoading && !isError;

    return (
        <Box>
            {hasFullText && (
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
            )}
            {existing && (
                <Chip
                    icon={<OpenInNewIcon />}
                    color="primary"
                    label={`DOI: ${existing}`}
                    component="a"
                    href={`https://doi.org/${existing}`}
                    target="_blank"
                    clickable
                    sx={DisplayStudyChipLinksStyles.chip}
                    variant="outlined"
                />
            )}
            {existingPMID && (
                <Chip
                    icon={<OpenInNewIcon />}
                    color="primary"
                    label={`PubMed: ${existingPMID}`}
                    component="a"
                    href={`${PUBMED_ARTICLE_URL_PREFIX}${existingPMID}`}
                    target="_blank"
                    clickable
                    sx={DisplayStudyChipLinksStyles.chip}
                    variant="outlined"
                />
            )}
        </Box>
    );
};

export default DisplayStudyChipLinks;
