import { CircularProgress, CircularProgressProps } from '@mui/material';

const ProgressLoader = (props: CircularProgressProps) => {
    return <CircularProgress disableShrink {...props} />;
};

export default ProgressLoader;
