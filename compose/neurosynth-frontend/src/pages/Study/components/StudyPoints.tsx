import { HotTable } from '@handsontable/react';
import { Box, Typography } from '@mui/material';
import { registerAllModules } from 'handsontable/registry';
import styles from 'components/HotTables/HotTables.module.css';
import { IStorePoint, MapOrSpaceType } from 'pages/Study/store/StudyStore.helpers';
import { useEffect, useRef } from 'react';

registerAllModules();

const StudyPoints: React.FC<{
    title: string;
    statistic: MapOrSpaceType | undefined;
    space: MapOrSpaceType | undefined;
    points: IStorePoint[];
    height?: string;
}> = (props) => {
    const hotTableRef = useRef<HotTable>(null);
    const hotData = props.points.map((point) => [
        (point.coordinates || [])[0],
        (point.coordinates || [])[1],
        (point.coordinates || [])[2],
        point.value,
        point.cluster_size,
        point.subpeak,
    ]);

    // this allows handsontable to be responsive to the window...
    // Using this library has been soul crushing. We have to force it to update on window resize. render() and refreshDimensions()
    // don't do anything
    useEffect(() => {
        let debounce: NodeJS.Timeout;
        const resizeHandler = (event: UIEvent) => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => {
                if (hotTableRef?.current) {
                    hotTableRef?.current?.forceUpdate();
                }
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
                {props.title}
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
                    <Typography
                        sx={{ color: props.statistic ? '' : 'warning.dark', display: 'inline' }}
                    >
                        {props.statistic?.label || 'No Statistic selected'}
                    </Typography>
                </Box>
                <Box>
                    <Typography sx={{ display: 'inline' }}>Space: </Typography>
                    <Typography
                        sx={{ color: props.space ? '' : 'warning.dark', display: 'inline' }}
                    >
                        {props.space?.label || 'No space selected'}
                    </Typography>
                </Box>
            </Box>
            <Box sx={{ width: '100%' }}>
                {hotData.length === 0 ? (
                    <Typography sx={{ color: 'warning.dark' }}>
                        No coordinates have been added yet
                    </Typography>
                ) : (
                    <div style={{ width: '100%', height: '100%' }}>
                        <HotTable
                            ref={hotTableRef}
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
