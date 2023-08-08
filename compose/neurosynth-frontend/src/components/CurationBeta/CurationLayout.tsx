import { Box } from '@mui/material';

const CurationLayout: React.FC<{
    listItems: React.ReactNode;
    mainInterface: React.ReactNode;
    header?: React.ReactNode;
}> = (props) => {
    return (
        <Box sx={{ backgroundColor: 'rgb(242, 242, 242)', padding: '25px' }}>
            {props.header || <></>}
            <Box
                sx={{
                    display: 'flex',
                }}
            >
                <Box sx={{ width: '250px' }}>{props.listItems}</Box>
                <Box
                    sx={{
                        width: 'calc(100% - 250px)',
                        backgroundColor: 'rgb(244, 245, 247)',
                    }}
                >
                    {props.mainInterface}
                </Box>
            </Box>
        </Box>
    );
};

export default CurationLayout;
