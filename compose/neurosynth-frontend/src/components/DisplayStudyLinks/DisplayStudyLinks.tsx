import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Link, Tooltip } from '@mui/material';
import { PUBMED_ARTICLE_URL_PREFIX, PUBMED_CENTRAL_ARTICLE_URL_PREFIX } from 'hooks/external/useGetPubMedIds';
import { useStudyDOI, useStudyPMCID, useStudyPMID } from 'pages/Study/store/StudyStore';
import DisplayStudyLinksStyles from 'components/DisplayStudyLinks/DisplayStudyLinks.styles';
import DisplayStudyLinksFullText from 'components/DisplayStudyLinks/DisplayStudyLinksFullText';

const DisplayStudyLinks: React.FC<{
    studyName?: string | null;
    pmid?: string | null;
    doi?: string | null;
    pmcid?: string | null;
}> = (props) => {
    const studyStorePMID = useStudyPMID();
    const studyStoreDOI = useStudyDOI();
    const studyStorePMCID = useStudyPMCID();

    const { studyName, pmid, doi, pmcid } = props;

    const existingPMID = pmid || studyStorePMID;
    const existing = doi || studyStoreDOI;
    const existingPMCID = pmcid || studyStorePMCID;

    return (
        <Box sx={{ display: 'flex' }}>
            {existing && (
                <Link
                    color="primary"
                    href={`https://doi.org/${existing}`}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    sx={DisplayStudyLinksStyles.link}
                >
                    DOI Link
                    <OpenInNewIcon sx={{ marginLeft: '4px' }} fontSize="small" />
                </Link>
            )}
            {existingPMID && (
                <Link
                    color="primary"
                    href={`${PUBMED_ARTICLE_URL_PREFIX}${existingPMID}`}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    sx={DisplayStudyLinksStyles.link}
                >
                    Pubmed Study
                    <OpenInNewIcon sx={{ marginLeft: '4px' }} fontSize="small" />
                </Link>
            )}
            {existingPMCID && (
                <Tooltip placement="top" title="View the full article in HTML form via PubMed Central">
                    <Link
                        color="primary"
                        href={`${PUBMED_CENTRAL_ARTICLE_URL_PREFIX}${existingPMCID}`}
                        target="_blank"
                        rel="noreferrer"
                        underline="hover"
                        sx={DisplayStudyLinksStyles.Link}
                    >
                        full text (web)
                        <OpenInNewIcon sx={{ marginLeft: '4px' }} fontSize="small" />
                    </Link>
                </Tooltip>
            )}
            <DisplayStudyLinksFullText name={studyName} />
        </Box>
    );
};

export default DisplayStudyLinks;
