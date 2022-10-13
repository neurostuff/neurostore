import { Button, Divider, Link, Paper } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { IPubmedArticleItem } from 'components/Dialogs/AnnotateDialog/AnnotateDialog';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import useGetPubmedIDs, { IPubmedArticle } from 'hooks/requests/useGetPubmedIDs';
import { useEffect, useState } from 'react';

interface IPubmedWizardConfirmStep {
    pubmedIds: string[];
    onChangeStep: (change: ENavigationButton) => void;
    onUploadArticles: (articles: IPubmedArticle[]) => void;
}

const PubmedWizardConfirmStep: React.FC<IPubmedWizardConfirmStep> = (props) => {
    const { isLoading, isError, data } = useGetPubmedIDs(props.pubmedIds);
    const [articles, setArticles] = useState<IPubmedArticleItem[]>([]);

    // should only run when we have no articles in local memory
    useEffect(() => {
        if (data && articles.length === 0) {
            const articlesItems = data.map((article) => ({
                ...article,
                included: undefined,
            }));
            setArticles(articlesItems);
        }
    }, [data, articles]);

    const handleClickNext = (_event: React.MouseEvent) => {
        props.onUploadArticles(
            articles.map((x) => {
                const article = { ...x };
                delete article.included;
                return article;
            })
        );

        props.onChangeStep(ENavigationButton.NEXT);
    };

    return (
        <StateHandlerComponent isLoading={isLoading} isError={isError}>
            <Typography sx={{ fontWeight: 'bold' }} variant="h6">
                Uploading ({(data || []).length}) articles from pubmed
            </Typography>
            <Divider sx={{ margin: '1rem 0' }} />
            <Box>
                {(data || [])?.map((article, index) => {
                    const authorString = (article?.authors || []).reduce(
                        (prev, curr, index, arr) =>
                            `${prev}${curr.ForeName} ${curr.LastName}${
                                index === arr.length - 1 ? '' : ', '
                            }`,
                        ''
                    );

                    const abstractText =
                        typeof article?.abstractText === 'string'
                            ? article.abstractText
                            : (article?.abstractText || []).reduce(
                                  (prev, curr, index, arr) =>
                                      `${prev}${curr.label}\n${curr.text}\n`,
                                  ''
                              );

                    return (
                        <Box key={index} sx={{ padding: '0.25rem' }}>
                            <Link
                                rel="noopener"
                                underline="hover"
                                color="primary"
                                target="_blank"
                                href={article?.articleLink}
                            >
                                <Typography variant="h6">{article?.title}</Typography>
                            </Link>
                            <Typography variant="body1">{authorString}</Typography>
                            <Box sx={{ display: 'flex' }}>
                                <Typography variant="caption" sx={{ marginRight: '2rem' }}>
                                    PMID: {article?.PMID}
                                </Typography>
                                <Typography variant="caption">DOI: {article?.DOI || ''}</Typography>
                            </Box>
                            <TextExpansion
                                textSx={{ whiteSpace: 'break-spaces' }}
                                text={abstractText}
                            ></TextExpansion>
                        </Box>
                    );
                })}
            </Box>
            <Paper
                sx={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    position: 'sticky',
                    bottom: 0,
                    padding: '1rem 0',
                }}
                elevation={0}
            >
                <Button
                    onClick={() => {
                        props.onChangeStep(ENavigationButton.PREV);
                    }}
                    color="primary"
                >
                    previous
                </Button>
                <Button color="primary" variant="contained" onClick={handleClickNext}>
                    upload
                </Button>
            </Paper>
        </StateHandlerComponent>
    );
};

export default PubmedWizardConfirmStep;
