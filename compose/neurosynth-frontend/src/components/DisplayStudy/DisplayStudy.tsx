import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Badge, Box, Chip, Divider, TableCell, TableRow, Typography } from '@mui/material';
import { getType } from 'components/EditMetadata';
import { sortMetadataArrayFn } from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthTable, { getValue } from 'components/Tables/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import useGetFullText from 'hooks/external/useGetFullText';
import { PUBMED_ARTICLE_URL_PREFIX } from 'hooks/external/useGetPubMedIds';
import { IStoreStudy } from 'pages/Studies/StudyStore.helpers';
import { Optional } from 'utils/utilitytypes';
import DisplayAnalyses from './DisplayAnalyses/DisplayAnalyses';
import DisplayStudyStyles from './DisplayStudy.styles';

const DisplayStudy: React.FC<Optional<IStoreStudy, 'metadata'>> = (props) => {
    const {
        id,
        name,
        description,
        doi,
        pmid,
        authors,
        publication,
        metadata,
        analyses = [],
    } = props;
    const { data: fullTextURL, isLoading, isError } = useGetFullText(name || '');

    const hasFullText = !!fullTextURL && !isLoading && !isError;

    return (
        <Box>
            <Box data-tour="StudyPage-1" sx={{ padding: '0 1rem' }}>
                <Box sx={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
                    {id && (
                        <Chip
                            variant="filled"
                            sx={{ marginRight: '5px', borderRadius: '8px' }}
                            size="medium"
                            label={id || ''}
                        />
                    )}
                    <Typography sx={{ display: 'inline' }} variant="h6">
                        <b>{name}</b>
                    </Typography>
                </Box>
                <Typography>{authors}</Typography>
                <Box>
                    <Typography gutterBottom>{publication}</Typography>
                    {hasFullText && (
                        <Chip
                            icon={<OpenInNewIcon />}
                            color="primary"
                            label="Full Text"
                            component="a"
                            href={fullTextURL}
                            target="_blank"
                            clickable
                            sx={{ width: '200px', marginRight: '15px' }}
                            variant="outlined"
                        />
                    )}
                    {doi && (
                        <Chip
                            icon={<OpenInNewIcon />}
                            color="primary"
                            label={`DOI: ${doi}`}
                            component="a"
                            href={`https://doi.org/${doi}`}
                            target="_blank"
                            clickable
                            sx={{ width: '200px', marginRight: '15px' }}
                            variant="outlined"
                        />
                    )}
                    {pmid && (
                        <Chip
                            icon={<OpenInNewIcon />}
                            color="primary"
                            label={`PubMed: ${pmid}`}
                            component="a"
                            href={`${PUBMED_ARTICLE_URL_PREFIX}${pmid}`}
                            target="_blank"
                            clickable
                            sx={{ width: '200px' }}
                            variant="outlined"
                        />
                    )}
                </Box>
                <TextExpansion
                    text={description || ''}
                    sx={{
                        margin: '8px 0',
                        color: 'gray',
                        whiteSpace: 'pre-wrap',
                    }}
                />
            </Box>
            {metadata && (
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
                        TitleElement={
                            <Typography sx={{ color: 'primary.main' }}>Metadata</Typography>
                        }
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
                                    .sort((a, b) =>
                                        sortMetadataArrayFn(a.metadataKey, b.metadataKey)
                                    )
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
            )}

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
                            <DisplayAnalyses id={id} analyses={analyses} />
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    );
};

export default DisplayStudy;
