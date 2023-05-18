import { HotTable } from '@handsontable/react';
import { Box, Typography } from '@mui/material';
import { registerAllModules } from 'handsontable/registry';
import { PointReturn } from 'neurostore-typescript-sdk';
import styles from 'components/EditAnnotations/AnnotationsHotTable/AnnotationsHotTable.module.css';

registerAllModules();

const DisplayPoints: React.FC<{ points: PointReturn[] }> = (props) => {
    const hotData = props.points.map((point) => [
        (point.coordinates || [])[0],
        (point.coordinates || [])[1],
        (point.coordinates || [])[2],
        point.kind,
        point.space,
    ]);

    return (
        <Box sx={{ width: '100%' }}>
            <Typography sx={{ fontWeight: 'bold', marginBottom: '0.5rem' }} gutterBottom>
                Coordinates
            </Typography>
            <Box sx={{ width: '100%' }}>
                {hotData.length === 0 ? (
                    <Typography sx={{ color: 'warning.dark' }}>
                        No coordinates have been added yet
                    </Typography>
                ) : (
                    <HotTable
                        manualColumnResize
                        data={hotData}
                        columns={[
                            {
                                className: styles.number,
                            },
                            {
                                className: styles.number,
                            },
                            {
                                className: styles.number,
                            },
                            {
                                className: styles.string,
                            },
                            {
                                className: styles.string,
                            },
                        ]}
                        colHeaders={['X', 'Y', 'Z', 'Kind', 'Space']}
                        colWidths={[50, 50, 50, 150, 150]}
                        licenseKey="non-commercial-and-evaluation"
                        readOnly
                    />
                )}
            </Box>
        </Box>
    );
};

export default DisplayPoints;
