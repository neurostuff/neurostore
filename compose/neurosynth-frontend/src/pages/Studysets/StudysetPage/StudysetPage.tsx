import { useAuth0 } from '@auth0/auth0-react';
import { Typography, Box, Button, IconButton, Link, TableRow, TableCell } from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import { useHistory } from 'react-router';
import AddIcon from '@mui/icons-material/Add';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import TextEdit from 'components/TextEdit/TextEdit';
import StudysetPageStyles from './StudysetPage.styles';
import HelpIcon from '@mui/icons-material/Help';
import useGetTour from 'hooks/useGetTour';
import {
    useCreateAnnotation,
    useDeleteStudyset,
    useGetAnnotationsByStudysetId,
    useGetStudysetById,
    useUpdateStudyset,
} from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useIsFetching } from 'react-query';
import { NavLink } from 'react-router-dom';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import PubmedDialog from 'components/Dialogs/PubmedDialog/PubmedDialog';
import AnnotationContainer, {
    IAnnotationContainer,
} from 'components/AnnotationContainer/AnnotationContainer';
import { IPubmedArticle } from 'hooks/requests/useGetPubmedIDs';
import { IDraggableItem, ITag } from 'components/AnnotationContainer/DraggableItem/DraggableItem';

const StudysetsPage: React.FC = (props) => {
    const { startTour } = useGetTour('StudysetPage');
    const { user, isAuthenticated } = useAuth0();
    const history = useHistory();

    const [deleteStudysetConfirmationIsOpen, setDeleteStudysetConfirmationIsOpen] = useState(false);
    const [
        deleteStudyFromStudysetConfirmationIsOpen,
        setDeleteStudyFromStudysetConfirmationIsOpen,
    ] = useState<{ isOpen: boolean; data: any }>({ isOpen: false, data: undefined });
    const [createDetailsIsOpen, setCreateDetailsIsOpen] = useState(false);

    const params: { studysetId: string } = useParams();

    const { mutate: updateStudysetName, isLoading: updateStudysetNameIsLoading } =
        useUpdateStudyset();
    const { mutate: updateStudysetDescription, isLoading: updateStudysetDescriptionIsLoading } =
        useUpdateStudyset();
    const { mutate: updateStudysetPublication, isLoading: updateStudysetPublicationIsLoading } =
        useUpdateStudyset();
    const { mutate: updateStudysetDoi, isLoading: updateStudysetDoiIsLoading } =
        useUpdateStudyset();
    const { mutate: deleteStudyFromStudyset, isLoading: deleteStudyFromStudysetIsLoading } =
        useUpdateStudyset();
    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isError: getStudysetIsError,
    } = useGetStudysetById(params.studysetId);
    const isFetching = useIsFetching(['studysets', params.studysetId]);
    const { data: annotations, isLoading: getAnnotationsIsLoading } = useGetAnnotationsByStudysetId(
        params?.studysetId
    );
    const { mutate: createAnnotation } = useCreateAnnotation();
    const { mutate: deleteStudyset } = useDeleteStudyset();

    const [pubmedDialogIsOpen, setPubmedDialogIsOpen] = useState(false);

    const thisUserOwnsthisStudyset = (studyset?.user || undefined) === (user?.sub || null);

    const handleUpdateField = (updatedText: string, label: string) => {
        const updateStudysetObj = {
            studysetId: params.studysetId,
            studyset: {
                [label]: updatedText,
            },
        };
        /**
         * in order to make sure that each field visually loads independently, we need to split the studyset update
         * into separate useQuery instances (otherwise to name will show the loading icon for all fields)
         */
        switch (label) {
            case 'name':
                updateStudysetName(updateStudysetObj);
                break;
            case 'description':
                updateStudysetDescription(updateStudysetObj);
                break;
            case 'doi':
                updateStudysetDoi(updateStudysetObj);
                break;
            case 'publication':
                updateStudysetPublication(updateStudysetObj);
                break;
            default:
                break;
        }
    };

    // const handleCloseDeleteStudysetDialog = async (confirm: boolean | undefined) => {
    //     setDeleteStudysetConfirmationIsOpen(false);

    //     if (studyset?.id && confirm) {
    //         deleteStudyset(studyset?.id, {
    //             onSuccess: () => history.push('/userstudysets'),
    //         });
    //     }
    // };

    // const handleCloseDeleteStudyFromStudysetDialog = (confirm: boolean | undefined, data: any) => {
    //     if (confirm) {
    //         if (studyset && studyset.studies && params.studysetId && data?.studyId) {
    //             const updatedStudiesList = (studyset.studies as StudyReturn[]).filter(
    //                 (x) => x.id !== data.studyId
    //             );

    //             deleteStudyFromStudyset({
    //                 studysetId: params.studysetId,
    //                 studyset: {
    //                     studies: updatedStudiesList.map((x) => x.id || ''),
    //                 },
    //             });
    //         }
    //     }
    //     setDeleteStudyFromStudysetConfirmationIsOpen({ isOpen: false, data: undefined });
    // };

    // const handleCreateAnnotation = async (name: string, description: string) => {
    //     if (studyset && params.studysetId) {
    //         createAnnotation({
    //             source: 'neurosynth',
    //             sourceId: undefined,
    //             annotation: {
    //                 name,
    //                 description,
    //                 note_keys: {},
    //                 studyset: params.studysetId,
    //             },
    //         });
    //     }
    // };

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

    useEffect(() => {
        setData((prev) => {
            const firstCol: IAnnotationContainer = {
                ...prev[0],
                itemList: [
                    ...prev[0].itemList,
                    ...((studyset?.studies || []) as StudyReturn[]).map((study: StudyReturn) => ({
                        id: study.id || '',
                        isDraft: false,
                        title: study.name || '',
                        authors: study.authors || '',
                        keywords: [],
                        pmid: '',
                        articleYear: study.year || undefined,
                        doi: study.doi || '',
                        abstractText: study.description || '',
                        articleLink: '',
                        exclusion: undefined,
                        tags: [],
                    })),
                ],
            };

            const newCols = [...prev];
            newCols[0] = firstCol;

            return newCols;
        });
    }, [studyset]);

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

    const handleAddColumn = () => {
        setData((prev) => {
            if (!prev) return prev;

            return [
                ...prev,
                {
                    columnTitle: 'New Column',
                    columnId: Math.random().toString(36).substr(2, 5),
                    itemList: [],
                },
            ];
        });
    };

    const handleUpdateAnnotationContainer = (update: IAnnotationContainer[]) => {
        setData(update);
    };

    return (
        <StateHandlerComponent
            isLoading={getStudysetIsLoading}
            isError={getStudysetIsError}
            errorMessage="There was an error getting the studyset"
        >
            <Box
                data-tour="StudysetPage-2"
                sx={{ display: 'flex', marginBottom: '1rem', width: '100%' }}
            >
                <Box sx={{ flexGrow: 1 }}>
                    <TextEdit
                        isLoading={updateStudysetNameIsLoading}
                        editIconIsVisible={thisUserOwnsthisStudyset}
                        onSave={handleUpdateField}
                        sx={{ fontSize: '2rem' }}
                        label="name"
                        textToEdit={studyset?.name || ''}
                    >
                        <Box sx={StudysetPageStyles.displayedText}>
                            <Typography
                                sx={[
                                    StudysetPageStyles.displayedText,
                                    !studyset?.name ? StudysetPageStyles.noData : {},
                                ]}
                                variant="h4"
                            >
                                {studyset?.name || 'No name'}
                            </Typography>
                        </Box>
                    </TextEdit>
                    <TextEdit
                        isLoading={updateStudysetPublicationIsLoading}
                        editIconIsVisible={thisUserOwnsthisStudyset}
                        sx={{ fontSize: '1.25rem' }}
                        onSave={handleUpdateField}
                        label="publication"
                        textToEdit={studyset?.publication || ''}
                    >
                        <Box sx={StudysetPageStyles.displayedText}>
                            <Typography
                                variant="h6"
                                sx={[
                                    StudysetPageStyles.displayedText,
                                    !studyset?.publication ? StudysetPageStyles.noData : {},
                                ]}
                            >
                                {studyset?.publication || 'No publication'}
                            </Typography>
                        </Box>
                    </TextEdit>
                    <TextEdit
                        isLoading={updateStudysetDoiIsLoading}
                        editIconIsVisible={thisUserOwnsthisStudyset}
                        sx={{ fontSize: '1.25rem' }}
                        label="doi"
                        onSave={handleUpdateField}
                        textToEdit={studyset?.doi || ''}
                    >
                        <Box sx={StudysetPageStyles.displayedText}>
                            <Typography
                                variant="h6"
                                sx={[
                                    StudysetPageStyles.displayedText,
                                    !studyset?.doi ? StudysetPageStyles.noData : {},
                                ]}
                            >
                                {studyset?.doi || 'No DOI'}
                            </Typography>
                        </Box>
                    </TextEdit>
                    <TextEdit
                        isLoading={updateStudysetDescriptionIsLoading}
                        editIconIsVisible={thisUserOwnsthisStudyset}
                        sx={{ fontSize: '1.25rem' }}
                        onSave={handleUpdateField}
                        label="description"
                        textToEdit={studyset?.description || ''}
                        multiline
                    >
                        <Box
                            sx={{
                                ...StudysetPageStyles.displayedText,
                                ...(!studyset?.description ? StudysetPageStyles.noData : {}),
                            }}
                        >
                            <TextExpansion
                                textSx={{ fontSize: '1.25rem', whiteSpace: 'break-spaces' }}
                                text={studyset?.description || 'No description'}
                            />
                        </Box>
                    </TextEdit>
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
                    <IconButton onClick={() => startTour()} color="primary">
                        <HelpIcon />
                    </IconButton>
                </Box>
            </Box>

            <Box>
                <AnnotationContainer
                    onSetItem={handleSetItem}
                    onCreateTag={handleCreateTag}
                    onUpdateAnnotationContainer={handleUpdateAnnotationContainer}
                    onAddColumn={handleAddColumn}
                    tags={tags}
                    data={data}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default StudysetsPage;
