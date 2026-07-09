import { Typography } from '@mui/material';

interface IDynamicFormBaseTitle {
    name: string;
    description: string;
    disabled?: boolean;
}

const MetaAnalysisDynamicFormTitle: React.FC<IDynamicFormBaseTitle> = (props) => {
    return (
        <>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', opacity: props.disabled ? 0.4 : 1 }}>
                {props.name}
            </Typography>
            <Typography sx={{ marginBottom: '1rem', opacity: props.disabled ? 0.4 : 1 }} variant="subtitle2">
                {props.description}
            </Typography>
        </>
    );
};

export default MetaAnalysisDynamicFormTitle;
