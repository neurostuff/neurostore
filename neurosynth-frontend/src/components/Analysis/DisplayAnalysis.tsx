import { ExpandMoreOutlined } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Paper, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { Analysis } from '../../gen/api';
import DisplayAnalysisStyles from './DisplayAnalysisStyles';

const DisplayAnalysis: React.FC<Analysis> = (props) => {
    console.log(props);

    return (
        <Box sx={{ padding: '0 16px', overflowY: 'auto', maxHeight: '100%' }}>
            <Typography sx={DisplayAnalysisStyles.spaceBelow} variant="h5">
                {props.name}
            </Typography>
            <Typography sx={DisplayAnalysisStyles.spaceBelow} variant="caption">
                {props.description}
            </Typography>
            <Box sx={{ ...DisplayAnalysisStyles.spaceBelow, width: '100%' }}>
                <Accordion elevation={4}>
                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                        Coordinates
                    </AccordionSummary>
                    <AccordionDetails>
                        {props.point?.length === 0 && (
                            <Box component="span" sx={{ color: 'warning.dark' }}>
                                No coordinates
                            </Box>
                            // DisplayValuesTable
                        )}
                    </AccordionDetails>
                </Accordion>
            </Box>
            <Box></Box>
        </Box>
    );
};

export default DisplayAnalysis;

// {
/* <Box sx={{ width: '100%', display: 'flex' }}>
<div style={{ width: '45%' }}>
    <Paper
        sx={StudyPageStyles.spaceBelow}
        style={{ padding: '30px', backgroundColor: '#0077b6' }}
    >
        <Typography style={{ color: 'white' }}>Hello</Typography>
        <Box sx={StudyPageStyles.spaceBelow}>
            <Accordion elevation={1}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                    Coordinates
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={StudyPageStyles.metadataContainer}>
                        {study && (
                            <DisplayMetadataTable
                                metadata={study.metadata}
                            />
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Box>

        <div>
            <Accordion elevation={1}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                    Analysis Metadata
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={StudyPageStyles.metadataContainer}>
                        {study && (
                            <DisplayMetadataTable
                                metadata={study.metadata}
                            />
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </div>
    </Paper>

    <Paper
        sx={StudyPageStyles.spaceBelow}
        style={{ padding: '30px', backgroundColor: '#0077b6' }}
    >
        <Typography style={{ color: 'white' }}>Hello</Typography>
        <Box sx={StudyPageStyles.spaceBelow}>
            <Accordion elevation={1}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                    Coordinates
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={StudyPageStyles.metadataContainer}>
                        {study && (
                            <DisplayMetadataTable
                                metadata={study.metadata}
                            />
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Box>

        <div>
            <Accordion elevation={1}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                    Analysis Metadata
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={StudyPageStyles.metadataContainer}>
                        {study && (
                            <DisplayMetadataTable
                                metadata={study.metadata}
                            />
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </div>
    </Paper>

    <Paper
        sx={StudyPageStyles.spaceBelow}
        style={{ padding: '30px', backgroundColor: '#0077b6' }}
    >
        <Typography style={{ color: 'white' }}>Hello</Typography>
        <Box sx={StudyPageStyles.spaceBelow}>
            <Accordion elevation={1}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                    Coordinates
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={StudyPageStyles.metadataContainer}>
                        {study && (
                            <DisplayMetadataTable
                                metadata={study.metadata}
                            />
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Box>

        <div>
            <Accordion elevation={1}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                    Analysis Metadata
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={StudyPageStyles.metadataContainer}>
                        {study && (
                            <DisplayMetadataTable
                                metadata={study.metadata}
                            />
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </div>
    </Paper>

    <Paper
        sx={StudyPageStyles.spaceBelow}
        style={{ padding: '30px', backgroundColor: '#0077b6' }}
    >
        <Typography style={{ color: 'white' }}>Hello</Typography>
        <Box sx={StudyPageStyles.spaceBelow}>
            <Accordion elevation={1}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                    Coordinates
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={StudyPageStyles.metadataContainer}>
                        {study && (
                            <DisplayMetadataTable
                                metadata={study.metadata}
                            />
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Box>

        <div>
            <Accordion elevation={1}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                    Analysis Metadata
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={StudyPageStyles.metadataContainer}>
                        {study && (
                            <DisplayMetadataTable
                                metadata={study.metadata}
                            />
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </div>
    </Paper>

    <Paper
        sx={StudyPageStyles.spaceBelow}
        style={{ padding: '30px', backgroundColor: '#0077b6' }}
    >
        <Typography style={{ color: 'white' }}>Hello</Typography>
        <Box sx={StudyPageStyles.spaceBelow}>
            <Accordion elevation={1}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                    Coordinates
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={StudyPageStyles.metadataContainer}>
                        {study && (
                            <DisplayMetadataTable
                                metadata={study.metadata}
                            />
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Box>

        <div>
            <Accordion elevation={1}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                    Analysis Metadata
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={StudyPageStyles.metadataContainer}>
                        {study && (
                            <DisplayMetadataTable
                                metadata={study.metadata}
                            />
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </div>
    </Paper>
</div>
<div
    style={{
        width: '55%',
    }}
>
    <div
        style={{
            marginLeft: 'auto',
            position: 'sticky',
            top: '47px',
            width: '550px',
            height: '450px',
            backgroundColor: 'black',
            color: 'white',
        }}
    >
        Papaya Visualizer placeholder
    </div>
</div>
</Box> */
// }
