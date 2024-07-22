import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Chip, Tooltip } from '@mui/material';
import {
    PUBMED_ARTICLE_URL_PREFIX,
    PUBMED_CENTRAL_ARTICLE_URL_PREFIX,
} from 'hooks/external/useGetPubMedIds';
import { useStudyDOI, useStudyPMCID, useStudyPMID } from 'pages/Study/store/StudyStore';
import DisplayStudyChipLinksStyles from 'components/DisplayStudyChipLinks/DisplayStudyChipLinks.styles';
import DisplayStudyChipLinksFullText from 'components/DisplayStudyChipLinks/DisplayStudyChipLinksFullText';

const DisplayStudyChipLinks: React.FC<{
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
        <Box>
            {existing && (
                <Chip
                    icon={<OpenInNewIcon />}
                    color="primary"
                    label={`DOI link`}
                    component="a"
                    href={`https://doi.org/${existing}`}
                    target="_blank"
                    rel="noreferrer"
                    clickable
                    sx={DisplayStudyChipLinksStyles.chip}
                    variant="outlined"
                />
            )}
            {existingPMID && (
                <Chip
                    icon={<OpenInNewIcon />}
                    color="primary"
                    label={`pubmed study`}
                    component="a"
                    href={`${PUBMED_ARTICLE_URL_PREFIX}${existingPMID}`}
                    target="_blank"
                    rel="noreferrer"
                    clickable
                    sx={DisplayStudyChipLinksStyles.chip}
                    variant="outlined"
                />
            )}
            {existingPMCID && (
                <Tooltip
                    placement="top"
                    title="View the full article in HTML form via PubMed Central"
                >
                    <Chip
                        icon={<OpenInNewIcon />}
                        color="primary"
                        label={`full text (web)`}
                        component="a"
                        href={`${PUBMED_CENTRAL_ARTICLE_URL_PREFIX}${existingPMCID}`}
                        rel="noreferrer"
                        target="_blank"
                        clickable
                        sx={DisplayStudyChipLinksStyles.chip}
                        variant="outlined"
                    />
                </Tooltip>
            )}
            <DisplayStudyChipLinksFullText name={studyName} />
        </Box>
    );
};

export default DisplayStudyChipLinks;
