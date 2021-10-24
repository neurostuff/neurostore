import { ExpandMoreOutlined } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useEffect, useState } from 'react';
import { DisplayValuesTable, DisplayValuesTableModel, TextExpansion } from '..';
import { Analysis, Condition, Point, ReadOnly, Image } from '../../gen/api';
import DisplayImagesTable from '../DisplayImagesTable/DisplayImagesTable';
import Visualizer from '../Visualizer/Visualizer';
import DisplayAnalysisStyles from './DisplayAnalysisStyles';

const DisplayAnalysis: React.FC<Analysis> = (props) => {
    const [selectedImage, setSelectedImage] = useState<(Image & ReadOnly) | undefined>(undefined);

    if (!props || Object.keys(props).length === 0) {
        return (
            <Box component="span" sx={{ color: 'warning.dark' }}>
                No analysis
            </Box>
        );
    }

    const coordinateDataForTable: DisplayValuesTableModel = {
        columnHeaders: ['X', 'Y', 'Z', 'Kind', 'Space'],
        rowData: (props?.points as (Point & ReadOnly)[]).map((point) => ({
            uniqueKey: point.id as string,
            columnValues: [
                {
                    value: point.coordinates ? point?.coordinates[0] : undefined,
                    colorByType: true,
                    bold: false,
                },
                {
                    value: point.coordinates ? point?.coordinates[1] : undefined,
                    colorByType: true,
                    bold: false,
                },
                {
                    value: point.coordinates ? point?.coordinates[2] : undefined,
                    colorByType: true,
                    bold: false,
                },
                {
                    value: point.kind as string,
                    colorByType: true,
                    bold: false,
                },
                {
                    value: point.space as string,
                    colorByType: true,
                    bold: false,
                },
            ],
        })),
    };

    const handleSelectImage = (selectedImage: Image & ReadOnly) => {
        setSelectedImage(selectedImage);
    };

    const conditionsForTable: DisplayValuesTableModel = {
        columnHeaders: ['Condition', 'Weight'],
        rowData: (props?.conditions as (Condition & ReadOnly)[]).map((condition, index) => ({
            uniqueKey: condition.id || index.toString(),
            columnValues: [
                {
                    value: condition.name,
                    colorByType: false,
                    bold: false,
                },
                {
                    value: (props?.weights || [])[index],
                    colorByType: false,
                    bold: false,
                },
            ],
        })),
    };

    return (
        <Box sx={DisplayAnalysisStyles.analysisContainer}>
            <Box
                sx={{
                    ...DisplayAnalysisStyles.section,
                    ...DisplayAnalysisStyles.leftSection,
                }}
            >
                <Typography sx={DisplayAnalysisStyles.spaceBelow} variant="h5">
                    {props.name}
                </Typography>
                <TextExpansion
                    sx={DisplayAnalysisStyles.spaceBelow}
                    text={props.description || ''}
                ></TextExpansion>
                <Box sx={{ ...DisplayAnalysisStyles.spaceBelow, width: '100%' }}>
                    <Accordion defaultExpanded={true} elevation={4}>
                        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                            Conditions
                        </AccordionSummary>
                        <AccordionDetails>
                            {(props?.conditions || []).length > 0 && (
                                <DisplayValuesTable {...conditionsForTable} />
                            )}
                            {(props.conditions || []).length === 0 && (
                                <Box component="span" sx={{ color: 'warning.dark' }}>
                                    No conditions
                                </Box>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Box>
                <Box
                    sx={{
                        ...DisplayAnalysisStyles.spaceBelow,
                        ...DisplayAnalysisStyles.removeTablePadding,
                        width: '100%',
                    }}
                >
                    <Accordion elevation={4}>
                        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                            Coordinates
                        </AccordionSummary>
                        <AccordionDetails>
                            {(props?.points || []).length > 0 && (
                                <DisplayValuesTable {...coordinateDataForTable} />
                            )}
                            {(props.points || []).length === 0 && (
                                <Box component="span" sx={{ color: 'warning.dark' }}>
                                    No coordinates
                                </Box>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Box>
                <Box sx={{ ...DisplayAnalysisStyles.spaceBelow }}>
                    <Accordion defaultExpanded={true} elevation={4}>
                        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                            Images
                        </AccordionSummary>
                        <AccordionDetails>
                            <DisplayImagesTable
                                onSelectImage={handleSelectImage}
                                images={props.images as (Image & ReadOnly)[]}
                            />
                        </AccordionDetails>
                    </Accordion>
                </Box>
            </Box>
            {selectedImage && (
                <Box
                    sx={{ ...DisplayAnalysisStyles.section, ...DisplayAnalysisStyles.rightSection }}
                >
                    <Box sx={DisplayAnalysisStyles.visualizerContainer}>
                        <Visualizer
                            sx={DisplayAnalysisStyles.visualizer}
                            overlayURL="https://neurovault.org/static/images/GenericMNI.nii.gz"
                            imageURL={selectedImage.url || ''}
                            fileName={selectedImage.filename || ''}
                            index={0}
                        />
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default DisplayAnalysis;
