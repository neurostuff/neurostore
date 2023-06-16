import { HotTable } from '@handsontable/react';
import { Box, Typography } from '@mui/material';
import { registerAllModules } from 'handsontable/registry';
import styles from 'components/EditAnnotations/AnnotationsHotTable/AnnotationsHotTable.module.css';
import { IStorePoint } from 'pages/Studies/StudyStore.helpers';

registerAllModules();

const DisplayPoints: React.FC<{ title: string; points: IStorePoint[]; height?: string }> = (
    props
) => {
    const hotData = props.points.map((point) => [
        (point.coordinates || [])[0],
        (point.coordinates || [])[1],
        (point.coordinates || [])[2],
        point.value,
        point.cluster_size,
        point.subpeak,
    ]);

    return (
        <Box sx={{ width: '100%' }}>
            <Typography sx={{ fontWeight: 'bold', marginBottom: '0.5rem' }} gutterBottom>
                {props.title}
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
                        height={props.height}
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
                                className: styles.number,
                            },
                            {
                                className: styles.number,
                            },
                            {
                                className: styles.boolean,
                            },
                        ]}
                        colHeaders={['X', 'Y', 'Z', 'Value', 'Cluster Size (mm^3)', 'Subpeak?']}
                        colWidths={[50, 50, 50, 150, 150, 100]}
                        licenseKey="non-commercial-and-evaluation"
                        readOnly
                    />
                )}
            </Box>
        </Box>
    );
};

export default DisplayPoints;
