import { Typography } from '@mui/material';

interface IDynamicFormBaseTitle {
    name: string;
    description: string;
}

const DynamicFormBaseTitle: React.FC<IDynamicFormBaseTitle> = (props) => {
    return (
        <>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {props.name}
            </Typography>
            <Typography sx={{ marginBottom: '1rem' }} variant="subtitle2">
                {props.description}
            </Typography>
        </>
    );
};

export default DynamicFormBaseTitle;
