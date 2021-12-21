import { Typography, Button, Box } from '@mui/material';
import { useState } from 'react';
import Spreadsheet from 'react-spreadsheet';

const EditAnnotationsPage: React.FC = (props) => {
    const x = (y: any) => {
        console.log(y);
    };

    const [data, setData] = useState([
        [{ value: 'ABC' }, { value: 'DEF' }],
        [{ value: 'GHI' }, { value: 'JKL' }],
    ]);

    return (
        <>
            <Typography sx={{ marginBottom: '1rem' }} variant="h4">
                Annotation
            </Typography>
            <Box
                component={Spreadsheet}
                rowLabels={['Hello', 'World', 'SMTH']}
                columnLabels={['another', 'value', 'ok']}
                onChange={x}
                sx={{ marginBottom: '1rem' }}
                data={data}
            />
            <Button sx={{ display: 'block' }} variant="contained">
                Save Changes
            </Button>
        </>
    );
};

export default EditAnnotationsPage;
