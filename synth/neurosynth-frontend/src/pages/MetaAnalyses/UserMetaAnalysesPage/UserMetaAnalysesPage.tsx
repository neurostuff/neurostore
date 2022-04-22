import { Button } from '@mui/material';
import { useHistory } from 'react-router-dom';

const UserMetaAnalysesPage: React.FC = (props) => {
    const history = useHistory();

    return (
        <Button onClick={() => history.push('/meta-analyses/build')} color="primary">
            Create meta analysis
        </Button>
    );
};

export default UserMetaAnalysesPage;
