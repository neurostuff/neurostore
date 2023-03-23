import { Typography, Box, TableRow, TableCell } from '@mui/material';
import { useEffect, useState } from 'react';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import Visualizer from 'components/Visualizer/Visualizer';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import DisplayAnalysisStyles from './DisplayAnalysis.styles';
import { DataGrid } from '@mui/x-data-grid';
import {
    AnalysisReturn,
    ConditionReturn,
    ImageReturn,
    NoteCollectionReturn,
    PointReturn,
} from 'neurostore-typescript-sdk';
import NeurosynthTable, { getValue } from 'components/Tables/NeurosynthTable/NeurosynthTable';
import DisplayImageTableRow from 'components/Tables/DisplayImageTableRow/DisplayImageTableRow';
import { NeurostoreAnnotation } from 'utils/api';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { getType } from 'components/EditMetadata';

export const ROW_HEIGHT = 56;

const DisplayAnalysis: React.FC<
    (AnalysisReturn | undefined) & { annotation: NeurostoreAnnotation | undefined }
> = (props) => {
    const [selectedImage, setSelectedImage] = useState<ImageReturn | undefined>(undefined);

    useEffect(() => {
        const images = props?.images as ImageReturn[];
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

    const annotationsForThisAnalysis = (
        (props.annotation?.notes as NoteCollectionReturn[]) || []
    ).find((x) => x?.analysis === props.id);
    const annotationRows = annotationsForThisAnalysis ? annotationsForThisAnalysis.note : {};

    const conditionRows = ((props?.conditions as ConditionReturn[]) || []).map(
        (condition, index) => ({
            id: condition.id,
            condition: condition.name,
            weight: (props?.weights || [])[index],
        })
    );

    const coordinateRows = ((props.points as PointReturn[]) || []).map((point, index) => ({
        id: point.id,
        x: point.coordinates ? point.coordinates[0] : 0,
        y: point.coordinates ? point.coordinates[1] : 0,
        z: point.coordinates ? point.coordinates[2] : 0,
        kind: point.kind || '',
        space: point.space || '',
    }));

    // 2 is for the borders
    // add one to account for column header
    // add one to account for the "no rows message"
    const conditionsGridHeight =
        2 + (conditionRows.length + 1 + (conditionRows.length === 0 ? 1 : 0)) * ROW_HEIGHT;

    const coordinateGridHeight =
        2 + (coordinateRows.length + 1 + (coordinateRows.length === 0 ? 1 : 0)) * ROW_HEIGHT;

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
                        TitleElement={<Typography>Annotations</Typography>}
                        defaultExpanded={Object.keys(annotationRows as object).length > 0}
                        elevation={2}
                    >
                        <Box sx={{ maxHeight: '600px' }}>
                            <NeurosynthTable
                                tableConfig={{
                                    tableHeaderBackgroundColor: 'white',
                                    tableElevation: 0,
                                }}
                                headerCells={[
                                    { text: 'Name', key: 'name', styles: { fontWeight: 'bold' } },
                                    { text: 'Value', key: 'value', styles: { fontWeight: 'bold' } },
                                ]}
                                rows={Object.entries(annotationRows || {}).map(([key, value]) => (
                                    <TableRow key={key}>
                                        <TableCell>{key}</TableCell>
                                        <TableCell
                                            sx={{
                                                color: NeurosynthTableStyles[getType(value)],
                                            }}
                                        >
                                            {getValue(value)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            />
                        </Box>
                    </NeurosynthAccordion>
                </Box>
                <Box
                    data-tour="StudyPage-4"
                    sx={[DisplayAnalysisStyles.spaceBelow, { width: '100%' }]}
                >
                    <NeurosynthAccordion
                        TitleElement={<Typography>Conditions</Typography>}
                        defaultExpanded={conditionRows.length > 0}
                        elevation={2}
                    >
                        <Box sx={{ height: `${conditionsGridHeight}px`, maxHeight: '600px' }}>
                            <DataGrid
                                disableColumnSelector
                                hideFooter
                                disableSelectionOnClick
                                showCellRightBorder
                                rowHeight={ROW_HEIGHT}
                                columns={[
                                    {
                                        field: 'condition',
                                        headerAlign: 'left',
                                        align: 'left',
                                        headerName: 'Condition',
                                        editable: false,
                                        flex: 1,
                                        type: 'string',
                                    },
                                    {
                                        field: 'weight',
                                        headerAlign: 'left',
                                        align: 'left',
                                        headerName: 'Weight',
                                        editable: false,
                                        flex: 1,
                                        type: 'number',
                                    },
                                ]}
                                rows={conditionRows}
                            />
                        </Box>
                    </NeurosynthAccordion>
                </Box>
                <Box
                    data-tour="StudyPage-5"
                    sx={[DisplayAnalysisStyles.spaceBelow, { width: '100%' }]}
                >
                    <NeurosynthAccordion
                        TitleElement={<Typography>Coordinates</Typography>}
                        defaultExpanded={coordinateRows.length > 0}
                        elevation={2}
                    >
                        <Box sx={{ height: `${coordinateGridHeight}px`, maxHeight: '600px' }}>
                            <DataGrid
                                disableColumnSelector
                                hideFooter
                                disableSelectionOnClick
                                showCellRightBorder
                                rowHeight={ROW_HEIGHT}
                                columns={[
                                    {
                                        field: 'x',
                                        headerAlign: 'left',
                                        align: 'left',
                                        headerName: 'X Coordinate',
                                        editable: false,
                                        flex: 1,
                                        type: 'string',
                                    },
                                    {
                                        field: 'y',
                                        headerAlign: 'left',
                                        align: 'left',
                                        headerName: 'Y Coordinate',
                                        editable: false,
                                        flex: 1,
                                        type: 'string',
                                    },
                                    {
                                        field: 'z',
                                        headerAlign: 'left',
                                        align: 'left',
                                        headerName: 'Z Coordinate',
                                        editable: false,
                                        flex: 1,
                                        type: 'string',
                                    },
                                    {
                                        field: 'kind',
                                        headerAlign: 'left',
                                        align: 'left',
                                        headerName: 'Kind',
                                        editable: false,
                                        flex: 1,
                                        type: 'string',
                                    },
                                    {
                                        field: 'space',
                                        headerAlign: 'left',
                                        align: 'left',
                                        headerName: 'Space',
                                        editable: false,
                                        flex: 1,
                                        type: 'string',
                                    },
                                ]}
                                rows={coordinateRows}
                            />
                        </Box>
                    </NeurosynthAccordion>
                </Box>
                <Box data-tour="StudyPage-6" sx={DisplayAnalysisStyles.spaceBelow}>
                    <NeurosynthAccordion
                        TitleElement={<Typography>Images</Typography>}
                        defaultExpanded={(props?.images || []).length > 0}
                        elevation={2}
                    >
                        <NeurosynthTable
                            tableConfig={{
                                tableHeaderBackgroundColor: 'transparent',
                                tableElevation: 0,
                                noDataDisplay: (
                                    <Typography sx={{ padding: '1rem', color: 'warning.dark' }}>
                                        No images
                                    </Typography>
                                ),
                            }}
                            headerCells={[
                                { text: '', key: 'dropdown', styles: {} },
                                { text: 'Type', key: 'type', styles: {} },
                                { text: 'Space', key: 'space', styles: {} },
                            ]}
                            rows={((props.images || []) as ImageReturn[]).map((image, index) => (
                                <DisplayImageTableRow
                                    key={image.id}
                                    image={image}
                                    onRowSelect={(image) => setSelectedImage(image)}
                                    active={selectedImage?.id === image.id || false}
                                />
                            ))}
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
