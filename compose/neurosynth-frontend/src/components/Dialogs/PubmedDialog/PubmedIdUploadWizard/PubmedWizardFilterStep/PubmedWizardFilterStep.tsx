import { List, Paper } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetPubmedIDs, { IPubmedArticle } from 'hooks/requests/useGetPubmedIDs';
import React, { useEffect, useState } from 'react';
import PubmedWizardStudyListItem from './PubmedWizardArticleSummary/PubmedWizardArticleListItem';
import PubmedWizardStudySummary from './PubmedWizardArticleSummary/PubmedWizardArticleSummary';

interface IPubmedWizardFilterStep {
    pubmedIds: string[];
    onSelectArticles: (selectedArticles: IPubmedArticle[]) => void;
    onChangeStep: (navigation: ENavigationButton) => void;
}

export type IPubmedArticleItem = IPubmedArticle & { included: boolean | undefined };

const PubmedWizardFilterStep: React.FC<IPubmedWizardFilterStep> = (props) => {
    const { data, isLoading, isError } = useGetPubmedIDs(props.pubmedIds);
    const [articles, setArticles] = useState<IPubmedArticleItem[]>([]);
    const [selectedArticleIndex, setSelectedArticleIndex] = useState<number>(0);

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

    const selectedArticle = articles[selectedArticleIndex];

    const handleInclude = (pubmedArticleItem: IPubmedArticleItem) => {
        setArticles((prev) => {
            const updatedArticles = [...prev];
            updatedArticles[selectedArticleIndex] = { ...pubmedArticleItem };
            return updatedArticles;
        });
        setSelectedArticleIndex((prev) => {
            return prev < articles.length - 1 ? prev + 1 : prev;
        });
    };

    const handleIncludeAll = (includeStatus: boolean | undefined) => {
        setArticles((prev) => {
            const updatedArticles = [...prev].map((article) => ({
                ...article,
                included: includeStatus,
            }));
            return updatedArticles;
        });
    };

    const handleClickNext = (_event: React.MouseEvent) => {
        const selectedArticles = [...articles].filter((x) => x.included);

        props.onSelectArticles(
            selectedArticles.map((x) => {
                const article = { ...x };
                delete article.included;
                return article;
            })
        );

        props.onChangeStep(ENavigationButton.NEXT);
    };

    const includedItemsExist = articles.some((x) => x.included);
    const uncategorizedItemsExist = articles.some((x) => x.included === undefined);

    return (
        <StateHandlerComponent
            isLoading={isLoading}
            isError={isError}
            loadingText="Fetching from PubMed"
        >
            <Box sx={{ marginBottom: '2rem' }}>
                <Button
                    sx={{ marginRight: '1rem' }}
                    onClick={() => handleIncludeAll(true)}
                    variant="outlined"
                    color="success"
                >
                    Include all articles
                </Button>
                <Button
                    sx={{ marginRight: '1rem' }}
                    onClick={() => handleIncludeAll(false)}
                    variant="outlined"
                    color="error"
                >
                    Exclude all articles
                </Button>
                <Button
                    color="secondary"
                    onClick={() => handleIncludeAll(undefined)}
                    variant="outlined"
                >
                    Reset
                </Button>
            </Box>
            <Box sx={{ display: 'flex', marginBottom: '2rem' }}>
                <Box sx={{ width: '30%' }}>
                    <Paper elevation={1} sx={{ maxHeight: '450px', overflowY: 'scroll' }}>
                        <List sx={{ width: '100%' }}>
                            {(articles || []).map((article, index) => (
                                <PubmedWizardStudyListItem
                                    selected={
                                        (selectedArticle?.DOI || undefined) ===
                                        (article?.DOI || null)
                                    }
                                    key={index}
                                    included={article.included}
                                    index={index}
                                    onSelect={(newIndex) => setSelectedArticleIndex(newIndex)}
                                    pubmedArticle={article}
                                />
                            ))}
                        </List>
                    </Paper>
                </Box>
                <Box sx={{ width: '70%' }}>
                    <PubmedWizardStudySummary article={selectedArticle} onInclude={handleInclude} />
                </Box>
            </Box>
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <Button
                    onClick={() => {
                        props.onChangeStep(ENavigationButton.PREV);
                    }}
                    color="primary"
                >
                    previous
                </Button>
                <Button
                    color="primary"
                    variant="contained"
                    onClick={handleClickNext}
                    disabled={!includedItemsExist || uncategorizedItemsExist}
                >
                    upload
                </Button>
            </Box>
        </StateHandlerComponent>
    );
};

export default PubmedWizardFilterStep;
