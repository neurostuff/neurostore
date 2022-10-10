import { Box, Button, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { IPubmedArticle } from 'hooks/requests/useGetPubmedIDs';
import { useEffect, useState } from 'react';

interface IPubmedWizardConfirmStep {
    selectedPubmedArticles: IPubmedArticle[];
    onUploadPubmedArticles: (articles: IPubmedArticle[]) => void;
    onClose: (event: any) => void;
}

const PubmedWizardConfirmStep: React.FC<IPubmedWizardConfirmStep> = (props) => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setTimeout(() => {
            props.onUploadPubmedArticles(props.selectedPubmedArticles);
            setIsLoading(false);
        }, 1500);
    }, []);

    return (
        <StateHandlerComponent isLoading={isLoading} isError={false}>
            <Box>
                <Typography variant="body1" color="success.main" sx={{ margin: '1rem 0' }}>
                    Pubmed Ids have been uploaded. You may now close the page.
                </Typography>
                <Button onClick={props.onClose} color="error">
                    Close
                </Button>
            </Box>
        </StateHandlerComponent>
    );
};

export default PubmedWizardConfirmStep;
