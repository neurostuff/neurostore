import { Typography, Box, Button, IconButton } from '@mui/material';
import { useState } from 'react';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import TextEdit from 'components/TextEdit/TextEdit';
import { StudyReturn } from 'neurostore-typescript-sdk';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import PubmedDialog from 'components/Dialogs/PubmedDialog/PubmedDialog';
import AnnotationContainer, {
    IAnnotationContainer,
} from 'components/AnnotationContainer/AnnotationContainer';
import { IPubmedArticle } from 'hooks/requests/useGetPubmedIDs';
import { IDraggableItem, ITag } from 'components/AnnotationContainer/DraggableItem/DraggableItem';

const CurationPage: React.FC = (props) => {
    const [createDetailsIsOpen, setCreateDetailsIsOpen] = useState(false);
    const [pubmedDialogIsOpen, setPubmedDialogIsOpen] = useState(false);

    const [data, setData] = useState<IAnnotationContainer[]>([
        {
            columnTitle: 'Identification',
            columnId: 'Z6IMIxo3pi',
            itemList: [],
        },
        {
            columnTitle: 'Screening',
            columnId: 'UWkA51xvWq',
            itemList: [],
        },
        {
            columnTitle: 'Eligibility',
            columnId: 'mwXy9n3ZZN',
            itemList: [],
        },
        {
            columnTitle: 'Included',
            columnId: '2HDSjEl3gD',
            itemList: [],
        },
    ]);

    const [tags, setTags] = useState<ITag[]>([
        {
            label: 'Save study For Later',
            id: '12rXnaWyk1',
            isExclusion: false,
        },
        {
            label: 'Favorites',
            id: '9fhwiabufw',
            isExclusion: false,
        },
        {
            label: 'Important',
            id: 'q3uyp4vtq3',
            isExclusion: false,
        },
        {
            label: 'Duplicate',
            id: 'DKvyYv93jI',
            isExclusion: true,
        },
        {
            label: 'Insufficient detail',
            id: 'JLSYm7Cs8O',
            isExclusion: true,
        },
        {
            label: 'Irrelevant',
            id: 'q1el7MBOiW',
            isExclusion: true,
        },
    ]);

    const handleCreateTag = (tagName: string, isExclusion: boolean) => {
        const newTag = {
            label: tagName,
            id: Math.random().toString(36).substr(2, 5),
            isExclusion,
        };
        setTags((prev) => {
            if (!prev) return [];
            const updatedTagList = [...prev, newTag];
            return updatedTagList;
        });

        return newTag;
    };

    const handleSetItem = (columnId: string, item: IDraggableItem) => {
        setData((prev) => {
            if (!prev) return prev;
            const colIndex = prev.findIndex((x) => x.columnId === columnId);
            if (colIndex < 0) return prev;

            const newItemIndex = prev[colIndex].itemList.findIndex((x) => x.id === item.id);
            if (newItemIndex < 0) return prev;

            const updatedItemList = [...prev[colIndex].itemList];
            updatedItemList[newItemIndex] = { ...item };

            const newCol = {
                ...prev[colIndex],
                itemList: [...updatedItemList],
            };

            const updatedState = [...prev];
            updatedState[colIndex] = newCol;
            return updatedState;
        });
    };

    const handleUploadPubmedArticles = (articles: IPubmedArticle[], tags: ITag[]) => {
        setData((prev) => {
            const updatedState = [...prev];

            const updatedFirstCol = { ...updatedState[0] };

            updatedFirstCol.itemList = [
                ...articles.map((x) => {
                    const authorString = (x.authors || []).reduce(
                        (prev, curr, index, arr) =>
                            `${prev}${curr.ForeName} ${curr.LastName}${
                                index === arr.length - 1 ? '' : ', '
                            }`,
                        ''
                    );

                    return {
                        id: x.PMID.toString(),
                        title: x.title,
                        pmid: x.PMID,
                        keywords: x.keywords,
                        doi: x.DOI,
                        articleLink: x.articleLink,
                        abstractText: x.abstractText,
                        articleYear: x.articleYear,
                        authors: authorString,
                        exclusion: undefined,
                        tags: [...tags],
                    };
                }),
                ...updatedFirstCol.itemList,
            ];

            updatedState[0] = updatedFirstCol;

            return updatedState;
        });
    };

    const handleUpdateAnnotationContainer = (update: IAnnotationContainer[]) => {
        setData(update);
    };

    return (
        <StateHandlerComponent
            isLoading={false}
            isError={false}
            errorMessage="There was an error getting the studyset"
        >
            <Box
                data-tour="StudysetPage-2"
                sx={{ display: 'flex', marginBottom: '1rem', width: '100%' }}
            >
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h4" color="primary">
                        Study Curation
                    </Typography>
                </Box>
                <Box sx={{ whiteSpace: 'nowrap' }}>
                    <PubmedDialog
                        allTags={tags}
                        onUploadPubmedArticles={handleUploadPubmedArticles}
                        isOpen={pubmedDialogIsOpen}
                        onCreateTag={handleCreateTag}
                        onClose={() => setPubmedDialogIsOpen(false)}
                        onSubmit={(list) => {}}
                    />
                    <Button
                        sx={{ marginRight: '1.5rem' }}
                        endIcon={<FileUploadIcon />}
                        variant="outlined"
                        color="primary"
                        onClick={() => setPubmedDialogIsOpen(true)}
                    >
                        import pubmed studies
                    </Button>
                </Box>
            </Box>

            <Box>
                <AnnotationContainer
                    onSetItem={handleSetItem}
                    onCreateTag={handleCreateTag}
                    onUpdateAnnotationContainer={handleUpdateAnnotationContainer}
                    tags={tags}
                    data={data}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default CurationPage;
