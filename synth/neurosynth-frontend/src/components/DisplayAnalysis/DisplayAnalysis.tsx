import { Typography, Box } from '@mui/material';
import { useEffect, useState } from 'react';
import {
    DisplayValuesTable,
    IDisplayValuesTableModel,
    TextExpansion,
    DisplayImagesTable,
    Visualizer,
    NeurosynthAccordion,
} from 'components';
import {
    AnalysisApiResponse,
    ConditionApiResponse,
    ImageApiResponse,
    PointApiResponse,
} from 'utils/api';
import DisplayAnalysisStyles from './DisplayAnalysis.styles';

const DisplayAnalysis: React.FC<AnalysisApiResponse | undefined> = (props) => {
    const [selectedImage, setSelectedImage] = useState<ImageApiResponse | undefined>(undefined);

    useEffect(() => {
        const images = props?.images as ImageApiResponse[];
        if (!images || images.length === 0) {
            // images does not exist or is empty
            setSelectedImage(undefined);
        } else if (images.length === 1) {
            // only one image
            setSelectedImage(images[0]);
        } else {
            // multiple images.
            // loop through and find the first image that has a T value type.
            // if none found, just display the first image
            let currentImage = images[0];
            for (let i = 0; i < images.length; i++) {
                if (images[i].value_type === 'T') {
                    currentImage = images[i];
                    break;
                }
            }
            setSelectedImage(currentImage);
        }
    }, [props?.images]);

    if (!props || Object.keys(props).length === 0) {
        return <Box sx={{ color: 'warning.dark', padding: '1rem' }}>No analysis</Box>;
    }

    const coordinateDataForTable: IDisplayValuesTableModel = {
        columnHeaders: [
            {
                value: 'X',
                center: false,
                bold: false,
            },
            {
                value: 'Y',
                center: false,
                bold: false,
            },
            {
                value: 'Z',
                center: false,
                bold: false,
            },
            {
                value: 'Kind',
                center: false,
                bold: false,
            },
            {
                value: 'Space',
                center: false,
                bold: false,
            },
        ],
        rowData: (props?.points as PointApiResponse[]).map((point) => ({
            uniqueKey: point.id as string,
            columnValues: [
                {
                    value: point.coordinates ? point?.coordinates[0] : undefined,
                    colorByType: true,
                    center: false,
                    bold: false,
                },
                {
                    value: point.coordinates ? point?.coordinates[1] : undefined,
                    colorByType: true,
                    center: false,
                    bold: false,
                },
                {
                    value: point.coordinates ? point?.coordinates[2] : undefined,
                    colorByType: true,
                    center: false,
                    bold: false,
                },
                {
                    value: point.kind as string,
                    colorByType: true,
                    center: false,
                    bold: false,
                },
                {
                    value: point.space as string,
                    colorByType: true,
                    center: false,
                    bold: false,
                },
            ],
        })),
    };

    const handleSelectImage = (selectedImage: ImageApiResponse | undefined) => {
        setSelectedImage(selectedImage);
    };

    const conditionsForTable: IDisplayValuesTableModel = {
        columnHeaders: [
            {
                value: 'Condition',
                bold: false,
                center: false,
            },
            {
                value: 'Weight',
                bold: false,
                center: false,
            },
        ],
        rowData: (props?.conditions as ConditionApiResponse[]).map((condition, index) => ({
            uniqueKey: condition.id || index.toString(),
            columnValues: [
                {
                    value: condition.name,
                    colorByType: false,
                    center: false,
                    bold: false,
                },
                {
                    value: (props?.weights || [])[index],
                    colorByType: false,
                    center: false,
                    bold: false,
                },
            ],
        })),
    };

    return (
        <Box sx={DisplayAnalysisStyles.analysisContainer}>
            <Box sx={[DisplayAnalysisStyles.leftSection, DisplayAnalysisStyles.section]}>
                <Typography sx={DisplayAnalysisStyles.spaceBelow} variant="h5">
                    {props.name}
                </Typography>
                <TextExpansion
                    sx={DisplayAnalysisStyles.spaceBelow}
                    text={props.description || ''}
                />
                <Box sx={[DisplayAnalysisStyles.spaceBelow, { width: '100%' }]}>
                    <NeurosynthAccordion
                        TitleElement={<Typography>Conditions</Typography>}
                        defaultExpanded={conditionsForTable.rowData.length > 0}
                        elevation={4}
                    >
                        <DisplayValuesTable {...conditionsForTable} />
                    </NeurosynthAccordion>
                </Box>
                <Box sx={[DisplayAnalysisStyles.spaceBelow, { width: '100%' }]}>
                    <NeurosynthAccordion
                        TitleElement={<Typography>Coordinates</Typography>}
                        defaultExpanded={coordinateDataForTable.rowData.length > 0}
                        elevation={4}
                    >
                        <DisplayValuesTable {...coordinateDataForTable} />
                    </NeurosynthAccordion>
                </Box>
                <Box sx={DisplayAnalysisStyles.spaceBelow}>
                    <NeurosynthAccordion
                        TitleElement={<Typography>Images</Typography>}
                        defaultExpanded={(props?.images || []).length > 0}
                        elevation={4}
                    >
                        <DisplayImagesTable
                            initialSelectedImage={selectedImage}
                            onSelectImage={handleSelectImage}
                            images={props.images as ImageApiResponse[]}
                        />
                    </NeurosynthAccordion>
                </Box>
            </Box>
            {selectedImage && (
                <Box sx={[DisplayAnalysisStyles.section, DisplayAnalysisStyles.rightSection]}>
                    <Box sx={DisplayAnalysisStyles.visualizerContainer}>
                        <Visualizer
                            styling={DisplayAnalysisStyles.visualizer}
                            imageURL={selectedImage.url || ''}
                            fileName={selectedImage.filename || ''}
                            template={(selectedImage?.metadata as any)?.target_template_image || ''}
                            index={0}
                        />
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default DisplayAnalysis;
