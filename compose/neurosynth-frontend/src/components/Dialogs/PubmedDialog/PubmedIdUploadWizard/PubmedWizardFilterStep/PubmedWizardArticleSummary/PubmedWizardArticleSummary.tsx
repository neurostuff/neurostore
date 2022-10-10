import CheckCircle from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { IPubmedArticleItem } from '../PubmedWizardFilterStep';

interface IPubmedWizardArticleSummary {
    article: IPubmedArticleItem | undefined;
    onInclude: (pubmedArticleItem: IPubmedArticleItem) => void;
}

const PubmedWizardArticleSummary: React.FC<IPubmedWizardArticleSummary> = (props) => {
    const { article, onInclude } = props;

    const authorString = (article?.authors || []).reduce(
        (prev, curr, index, arr) =>
            `${prev}${curr.ForeName} ${curr.LastName}${index === arr.length - 1 ? '' : ', '}`,
        ''
    );

    const keywordString = (article?.keywords || []).reduce(
        (prev, curr, index, arr) => `${prev}${curr}${index === arr.length - 1 ? '' : ', '}`,
        ''
    );

    const handleClickIncludeExclude = (include: boolean) => {
        if (article) {
            onInclude({ ...article, included: include });
        }
    };

    return (
        <Box sx={{ maxHeight: '450px', overflowY: 'scroll', padding: '0 1.5rem' }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    position: 'sticky',
                    top: 0,
                    paddingTop: '5px',
                    paddingBottom: '0.75rem',
                    backgroundColor: 'white',
                }}
            >
                <Box>
                    <Button
                        variant={props.article?.included ? 'contained' : 'outlined'}
                        sx={{ marginRight: '1rem' }}
                        startIcon={<CheckCircle />}
                        color="success"
                        onClick={() => handleClickIncludeExclude(true)}
                    >
                        Include
                    </Button>
                    <Button
                        onClick={() => handleClickIncludeExclude(false)}
                        variant={props.article?.included === false ? 'contained' : 'outlined'}
                        sx={{}}
                        startIcon={<CancelIcon />}
                        color="error"
                    >
                        Discard
                    </Button>
                </Box>
                {article?.articleLink && (
                    <Button
                        href={article?.articleLink}
                        target="_blank"
                        endIcon={<OpenInNewIcon />}
                        variant="outlined"
                    >
                        View article in PubMed
                    </Button>
                )}
            </Box>
            <Typography sx={{ marginBottom: '0.5rem' }} variant="h4">
                {article?.title || ''}
            </Typography>
            <Typography variant="h6">{authorString}</Typography>
            <Box sx={{ display: 'flex', marginBottom: '0.5rem' }}>
                <Typography variant="h6" sx={{ marginRight: '2rem' }}>
                    PMID: {article?.PMID}
                </Typography>
                <Typography variant="h6">DOI: {article?.DOI || ''}</Typography>
            </Box>
            <Typography sx={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
                {keywordString}
            </Typography>
            {typeof article?.abstractText === 'string' ? (
                <Typography variant="body1">{article?.abstractText || ''}</Typography>
            ) : (
                (article?.abstractText || []).map((x, index) => (
                    <Box key={index} sx={{ marginBottom: '0.5rem' }}>
                        <Typography sx={{ fontWeight: 'bold' }} variant="body1">
                            {x.label}
                        </Typography>
                        <Typography variant="body1">{x.text}</Typography>
                    </Box>
                ))
            )}
        </Box>
    );
};

export default PubmedWizardArticleSummary;
