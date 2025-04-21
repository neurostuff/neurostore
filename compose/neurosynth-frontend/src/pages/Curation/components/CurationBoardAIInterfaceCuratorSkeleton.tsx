import {
    Box,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';

const CurationBoardAIInterfaceCuratorSkeleton: React.FC = () => {
    return (
        <Box sx={{ padding: '1rem 2rem 0.5rem 1rem' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton variant="rounded" width={120} height={30} />
                <Skeleton variant="text" width={120} />
            </Box>
            <Box sx={{ display: 'flex', marginTop: '8px' }}>
                <Skeleton variant="rounded" width={150} height={30} />
            </Box>
            <TableContainer>
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell width="40px">
                                <Box>abc</Box>
                            </TableCell>
                            <TableCell>
                                <Box sx={{ width: '100%' }}>
                                    lorem eroignaeilugr blrguib liuaebrgliube iurlaebgaliubga <ilubaeiu>' '</ilubaeiu>
                                    Lorem ipsum dolor sit amet consectetur adipisicing elit. Minima distinctio sapiente
                                    qui a fugiat ratione nam est perferendis eaque soluta alias iure voluptatibus
                                    exercitationem, laboriosam debitis deserunt adipisci quasi in.
                                </Box>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow>
                            <TableCell>
                                <Skeleton variant="rounded" width="100%" height="30px" />
                            </TableCell>
                            <TableCell>def123</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', marginTop: '8px' }}>
                <Box sx={{ width: '210px', height: '20px' }}></Box>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ marginLeft: '2%' }} variant="body2">
                        Study
                    </Typography>
                </Box>
            </Box>
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <Box key={i} sx={{ display: 'flex', marginTop: '8px', justifyContent: 'space-between' }}>
                    <Skeleton variant="rounded" width={210} height={58} />
                    <Box
                        sx={{
                            flex: 1,
                            height: '50px',
                            padding: '4px',
                            display: 'flex',
                            justifyContent: 'space-around',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                        }}
                    >
                        <Skeleton animation="wave" width="100%" height={10} />
                        <Skeleton animation="wave" width="100%" height={10} />
                        <Skeleton animation="wave" width="100%" height={10} />
                        <Skeleton animation="wave" width="70%" height={10} />
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorSkeleton;
