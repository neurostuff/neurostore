import { Box, Divider, Link, TableCell, TableRow, Typography } from '@mui/material';
import { getType } from 'components/EditMetadata';
import { sortMetadataArrayFn } from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthTable, { getValue } from 'components/Tables/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import DisplayAnalyses from './DisplayAnalyses/DisplayAnalyses';
import DisplayStudyStyles from './DisplayStudy.styles';
import { PUBMED_ARTICLE_URL_PREFIX } from 'hooks/requests/useGetPubMedIds';
import FullTextLinkComponent from 'components/FullTextLinkComponent/FullTextLinkComponent';
import { IStoreStudy } from 'pages/Studies/StudyStore.helpers';

const DisplayStudy: React.FC<IStoreStudy> = (props) => {
    const {
        name,
        description,
        doi,
        pmid,
        authors,
        publication,
        metadata = [],
        analyses = [],
    } = props;

    return (
        <Box>
            <Box data-tour="StudyPage-1" sx={{ padding: '0 1rem' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6">
                        <b>{name}</b>
                    </Typography>
                </Box>
                <Typography>{authors}</Typography>
                <Box>
                    <Typography>{publication}</Typography>
                    <FullTextLinkComponent
                        paperTitle={name || ''}
                        text="View Full Text For This Study"
                    />
                    {doi && (
                        <Link
                            sx={{ display: 'block', margin: '5px 0' }}
                            target="_blank"
                            href={`https://doi.org/${doi}`}
                            underline="hover"
                        >
                            DOI: {doi}
                        </Link>
                    )}
                    {pmid && (
                        <Link
                            sx={{ display: 'block', margin: '5px 0' }}
                            target="_blank"
                            href={`${PUBMED_ARTICLE_URL_PREFIX}${pmid}`}
                            underline="hover"
                        >
                            PMID: {pmid}
                        </Link>
                    )}
                </Box>
                <TextExpansion
                    text={description || ''}
                    sx={{ ...DisplayStudyStyles.spaceBelow, whiteSpace: 'pre-wrap' }}
                />
            </Box>
            <Box data-tour="StudyPage-2" sx={{ margin: '15px' }}>
                <NeurosynthAccordion
                    elevation={0}
                    expandIconColor={'primary.main'}
                    sx={{
                        border: '1px solid',
                        borderColor: 'primary.main',
                    }}
                    accordionSummarySx={{
                        ':hover': {
                            backgroundColor: '#f2f2f2',
                        },
                    }}
                    TitleElement={<Typography sx={{ color: 'primary.main' }}>Metadata</Typography>}
                >
                    <Box sx={DisplayStudyStyles.metadataContainer}>
                        <NeurosynthTable
                            tableConfig={{
                                noDataDisplay: (
                                    <Typography sx={{ color: 'warning.dark', margin: '1rem' }}>
                                        No metadata
                                    </Typography>
                                ),
                                tableHeaderBackgroundColor: 'white',
                                tableElevation: 0,
                            }}
                            headerCells={[
                                { text: 'Name', key: 'name', styles: { fontWeight: 'bold' } },
                                { text: 'Value', key: 'value', styles: { fontWeight: 'bold' } },
                            ]}
                            rows={metadata
                                .sort((a, b) => sortMetadataArrayFn(a.metadataKey, b.metadataKey))
                                .map(({ metadataKey, metadataValue }) => (
                                    <TableRow key={metadataKey}>
                                        <TableCell>{metadataKey}</TableCell>
                                        <TableCell
                                            sx={{
                                                color: NeurosynthTableStyles[
                                                    getType(metadataValue)
                                                ],
                                            }}
                                        >
                                            {getValue(metadataValue)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                        />
                    </Box>
                </NeurosynthAccordion>
            </Box>

            <Box>
                <Typography
                    data-tour="StudyPage-3"
                    variant="h6"
                    sx={[
                        {
                            fontWeight: 'bold',
                            padding: '0 16px',
                        },
                        DisplayStudyStyles.spaceBelow,
                    ]}
                >
                    Analyses
                </Typography>
                {analyses?.length === 0 ? (
                    <Box sx={{ color: 'warning.dark', margin: '15px 0 0 15px' }}>
                        There are no analyses for this study.
                    </Box>
                ) : (
                    <>
                        <Box sx={{ marginBottom: '1rem', padding: '0 1rem' }}>
                            <Divider />
                            <DisplayAnalyses analyses={analyses} />
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    );
};

export default DisplayStudy;
