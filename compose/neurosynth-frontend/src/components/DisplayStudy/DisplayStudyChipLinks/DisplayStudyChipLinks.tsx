import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Chip } from '@mui/material';
import { PUBMED_ARTICLE_URL_PREFIX } from 'hooks/external/useGetPubMedIds';
import { useStudyDOI, useStudyPMID } from 'pages/Studies/StudyStore';
import DisplayStudyChipLinksStyles from './DisplayStudyChipLinks.styles';
import FullTextChip from './FullTextChip';

const DisplayStudyChipLinks: React.FC<{
    studyName?: string | null;
    pmid?: string | null;
    doi?: string | null;
}> = (props) => {
    const studyStorePMID = useStudyPMID();
    const studyStoreDOI = useStudyDOI();

    const { studyName, pmid, doi } = props;

    const existingPMID = pmid || studyStorePMID;
    const existing = doi || studyStoreDOI;

    return (
        <Box>
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
            <FullTextChip name={studyName} />
        </Box>
    );
};

export default DisplayStudyChipLinks;
