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
            <TableContainer sx={{ maxHeight: 'calc(100% - 48px - 32px - 2rem - 4px)' }}>
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead sx={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 999 }}>
                        <TableRow>
                            <TableCell
                                sx={{
                                    padding: '7px 0px',
                                    width: '40px',
                                    verticalAlign: 'bottom',
                                }}
                            >
                                <Box
                                    onClick={(e) => e.stopPropagation()}
                                    sx={{ width: '100%', padding: '0px 6px' }}
                                ></Box>
                            </TableCell>
                            <TableCell sx={{ padding: '7px 0px', width: '150px', verticalAlign: 'bottom' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            height: '31.59px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0 6px',
                                        }}
                                    >
                                        Study
                                    </Typography>
                                </Box>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <TableRow key={i}>
                                <TableCell
                                    sx={{
                                        padding: '7px',
                                        height: 'inherit',
                                        lineHeight: 'normal',
                                        width: `40px`,
                                    }}
                                >
                                    <Box
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0px 6px',
                                        }}
                                    >
                                        <Skeleton variant="rounded" height="24px" width=" 24px" />
                                    </Box>
                                </TableCell>
                                <TableCell
                                    sx={{
                                        padding: '7px',
                                        height: 'inherit',
                                        lineHeight: 'normal',
                                        width: '150px',
                                    }}
                                >
                                    <Skeleton animation="wave" width="100%" height={24} />
                                    <Skeleton animation="wave" width="100%" height={16} />
                                    <Skeleton animation="wave" width="70%" height={16} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorSkeleton;
