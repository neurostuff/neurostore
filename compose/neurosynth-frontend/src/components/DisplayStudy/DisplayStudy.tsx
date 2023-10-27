import { Box, Chip, Divider, TableCell, TableRow, Typography } from '@mui/material';
import { getType } from 'components/EditMetadata';
import { sortMetadataArrayFn } from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthTable, { getValue } from 'components/Tables/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import { IStoreStudy } from 'pages/Studies/StudyStore.helpers';
import { Optional } from 'utils/utilitytypes';
import DisplayAnalyses from './DisplayAnalyses/DisplayAnalyses';
import DisplayStudyStyles from './DisplayStudy.styles';
import DisplayStudyChipLinks from './DisplayStudyChipLinks/DisplayStudyChipLinks';

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
    return (
        <Box>
            <Box data-tour="StudyPage-1">
                <Box sx={{ marginBottom: '0.5rem' }}>
                    {id && (
                        <Chip
                            variant="filled"
                            color="primary"
                            sx={{ marginRight: '5px', borderRadius: '8px', marginBottom: '0.5rem' }}
                            size="medium"
                            label={`Version: ${id}` || ''}
                        />
                    )}
                    <Typography variant="h6">
                        <b>{name}</b>
                    </Typography>
                </Box>
                <Typography>{authors}</Typography>
                <Box>
                    <Typography gutterBottom>{publication}</Typography>
                    <DisplayStudyChipLinks studyName={name} pmid={pmid} doi={doi} />
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
                <Box data-tour="StudyPage-2" sx={{ margin: '1rem 0' }}>
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
                        <Box sx={{ marginBottom: '1rem' }}>
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
