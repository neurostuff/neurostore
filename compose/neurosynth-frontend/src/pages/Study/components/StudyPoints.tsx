import { HotTable, HotTableRef } from '@handsontable/react-wrapper';
import { Box, Typography } from '@mui/material';
import { registerAllModules } from 'handsontable/registry';
import styles from 'components/HotTables/HotTables.module.css';
import { IStorePoint, MapOrSpaceType } from 'pages/Study/store/StudyStore.helpers';
import { useEffect, useRef } from 'react';

registerAllModules();

const StudyPoints = (props: {
    title?: string;
    statistic: MapOrSpaceType | undefined;
    space: MapOrSpaceType | undefined;
    points: IStorePoint[];
    height?: string;
}) => {
    const hotTableRef = useRef<HotTableRef>(null);
    const hotData = props.points.map((point) => [
        (point.coordinates || [])[0],
        (point.coordinates || [])[1],
        (point.coordinates || [])[2],
        point.value,
        point.cluster_size,
        point.subpeak,
    ]);

    // Handsontable does not always pick up container size changes on its own.
    useEffect(() => {
        let debounce: NodeJS.Timeout;
        const resizeHandler = () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => {
                hotTableRef.current?.hotInstance?.refreshDimensions();
            }, 100);
        };
        window.addEventListener('resize', resizeHandler);

        return () => {
            window.removeEventListener('resize', resizeHandler);
        };
    }, []);

    return (
        <Box sx={{ width: '100%' }}>
            <Typography sx={{ fontWeight: 'bold', marginBottom: '0.5rem' }} gutterBottom>
                {props.title ?? ''}
            </Typography>
            <Box
                sx={{
                    display: 'flex',
                    margin: '1rem 0',
                    justifyContent: 'space-between',
                }}
            >
                <Box>
                    <Typography sx={{ display: 'inline' }}>Statistic: </Typography>
                    <Typography sx={{ color: props.statistic ? '' : 'warning.dark', display: 'inline' }}>
                        {props.statistic?.label || 'No Statistic selected'}
                    </Typography>
                </Box>
                <Box>
                    <Typography sx={{ display: 'inline' }}>Space: </Typography>
                    <Typography sx={{ color: props.space ? '' : 'warning.dark', display: 'inline' }}>
                        {props.space?.label || 'No space selected'}
                    </Typography>
                </Box>
            </Box>
            <Box sx={{ width: '100%' }}>
                {hotData.length === 0 ? (
                    <Typography sx={{ color: 'warning.dark' }}>No coordinates have been added yet</Typography>
                ) : (
                    <div style={{ width: '100%', height: '100%' }}>
                        <HotTable
                            ref={hotTableRef}
                            theme="ht-theme-classic"
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
                            stretchH="all"
                            width="100%"
                            licenseKey="non-commercial-and-evaluation"
                            readOnly
                        />
                    </div>
                )}
            </Box>
        </Box>
    );
};

export default StudyPoints;
