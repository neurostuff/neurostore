import { Box } from '@mui/material';
import { ICurationStubStudy } from 'interfaces/project/curation.interface';
import CurationStubListItem from 'components/Dialogs/CurationDialog/CurationStubListItem/CurationStubListItem';
import EditableStubSummary from 'components/Dialogs/CurationDialog/EditableStubSummary/EditableStubSummary';
import useGetWindowHeight from 'hooks/useGetWindowHeight';
import { defaultIdentificationSources } from 'stores/ProjectStore.helpers';
import { FixedSizeList, ListChildComponentProps } from 'react-window';

const CurationDialogFixedSizeListRow: React.FC<
    ListChildComponentProps<{
        stubs: ICurationStubStudy[];
        selectedStubId: string | undefined;
        onSetSelectedStub: (stub: string) => void;
    }>
> = (props) => {
    const stub = props.data.stubs[props.index];
    const isSelected = props.data.selectedStubId === stub.id;

    return (
        <CurationStubListItem
            selected={isSelected}
            onSetSelectedStub={props.data.onSetSelectedStub}
            stub={stub}
            style={props.style}
        />
    );
};

const CurateStudies: React.FC = (props) => {
    const stubs: ICurationStubStudy[] = [
        {
            id: '1',
            title: 'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Soluta',
            authors: 'Lorem ipsum dolor sit amet consectetur',
            keywords: 'Lorem Ipsum dolor',
            pmid: '1231321',
            doi: 'doi:123131',
            articleYear: '2021',
            journal: 'BEHAVIORAL NEUROSCIENCE',
            abstractText:
                'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Esse quis dicta at commodi accusantium est suscipit, laudantium quia nihil necessitatibus cupiditate, eveniet magni eaque qui, unde officiis? Repellendus, illum unde?',
            articleLink: 'https://google.com',
            exclusionTag: null,
            import: {
                id: '',
                name: '',
                source: defaultIdentificationSources.neurostore,
            },
            tags: [
                {
                    id: 'test tag 1',
                    label: 'WoS Import',
                    isExclusionTag: false,
                    isAssignable: true,
                },
            ],
        },
        {
            id: '2',
            title: 'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Soluta',
            authors: 'Lorem ipsum dolor sit amet consectetur',
            keywords: 'Lorem Ipsum dolor',
            pmid: '1231321',
            doi: 'doi:123131',
            articleYear: '2021',
            journal: 'BEHAVIORAL NEUROSCIENCE',
            abstractText:
                'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Esse quis dicta at commodi accusantium est suscipit, laudantium quia nihil necessitatibus cupiditate, eveniet magni eaque qui, unde officiis? Repellendus, illum unde?',
            articleLink: 'https://google.com',
            exclusionTag: null,
            import: {
                id: '',
                name: '',
                source: defaultIdentificationSources.neurostore,
            },
            tags: [
                {
                    id: 'test tag 1',
                    label: 'WoS Import',
                    isExclusionTag: false,
                    isAssignable: true,
                },
            ],
        },
        {
            id: '3',
            title: 'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Soluta',
            authors: 'Lorem ipsum dolor sit amet consectetur',
            keywords: 'Lorem Ipsum dolor',
            pmid: '1231321',
            doi: 'doi:123131',
            articleYear: '2021',
            journal: 'BEHAVIORAL NEUROSCIENCE',
            abstractText:
                'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Esse quis dicta at commodi accusantium est suscipit, laudantium quia nihil necessitatibus cupiditate, eveniet magni eaque qui, unde officiis? Repellendus, illum unde?',
            articleLink: 'https://google.com',
            exclusionTag: null,
            import: {
                id: '',
                name: '',
                source: defaultIdentificationSources.neurostore,
            },
            tags: [
                {
                    id: 'test tag 1',
                    label: 'WoS Import',
                    isExclusionTag: false,
                    isAssignable: true,
                },
            ],
        },
        {
            id: '4',
            title: 'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Soluta',
            authors: 'Lorem ipsum dolor sit amet consectetur',
            keywords: 'Lorem Ipsum dolor',
            pmid: '1231321',
            doi: 'doi:123131',
            articleYear: '2021',
            journal: 'BEHAVIORAL NEUROSCIENCE',
            abstractText:
                'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Esse quis dicta at commodi accusantium est suscipit, laudantium quia nihil necessitatibus cupiditate, eveniet magni eaque qui, unde officiis? Repellendus, illum unde?',
            articleLink: 'https://google.com',
            exclusionTag: null,
            import: {
                id: '',
                name: '',
                source: defaultIdentificationSources.neurostore,
            },
            tags: [
                {
                    id: 'test tag 1',
                    label: 'WoS Import',
                    isExclusionTag: false,
                    isAssignable: true,
                },
            ],
        },
        {
            id: '5',
            title: 'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Soluta',
            authors: 'Lorem ipsum dolor sit amet consectetur',
            keywords: 'Lorem Ipsum dolor',
            pmid: '1231321',
            doi: 'doi:123131',
            articleYear: '2021',
            journal: 'BEHAVIORAL NEUROSCIENCE',
            abstractText:
                'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Esse quis dicta at commodi accusantium est suscipit, laudantium quia nihil necessitatibus cupiditate, eveniet magni eaque qui, unde officiis? Repellendus, illum unde?',
            articleLink: 'https://google.com',
            exclusionTag: null,
            import: {
                id: '',
                name: '',
                source: defaultIdentificationSources.neurostore,
            },
            tags: [
                {
                    id: 'test tag 1',
                    label: 'WoS Import',
                    isExclusionTag: false,
                    isAssignable: true,
                },
            ],
        },
        {
            id: '6',
            title: 'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Soluta',
            authors: 'Lorem ipsum dolor sit amet consectetur',
            keywords: 'Lorem Ipsum dolor',
            pmid: '1231321',
            doi: 'doi:123131',
            articleYear: '2021',
            journal: 'BEHAVIORAL NEUROSCIENCE',
            abstractText:
                'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Esse quis dicta at commodi accusantium est suscipit, laudantium quia nihil necessitatibus cupiditate, eveniet magni eaque qui, unde officiis? Repellendus, illum unde?',
            articleLink: 'https://google.com',
            exclusionTag: null,
            import: {
                id: '',
                name: '',
                source: defaultIdentificationSources.neurostore,
            },
            tags: [
                {
                    id: 'test tag 1',
                    label: 'WoS Import',
                    isExclusionTag: false,
                    isAssignable: true,
                },
            ],
        },
        {
            id: '7',
            title: 'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Soluta',
            authors: 'Lorem ipsum dolor sit amet consectetur',
            keywords: 'Lorem Ipsum dolor',
            pmid: '1231321',
            doi: 'doi:123131',
            articleYear: '2021',
            journal: 'BEHAVIORAL NEUROSCIENCE',
            abstractText:
                'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Esse quis dicta at commodi accusantium est suscipit, laudantium quia nihil necessitatibus cupiditate, eveniet magni eaque qui, unde officiis? Repellendus, illum unde?',
            articleLink: 'https://google.com',
            exclusionTag: null,
            import: {
                id: '',
                name: '',
                source: defaultIdentificationSources.neurostore,
            },
            tags: [
                {
                    id: 'test tag 1',
                    label: 'WoS Import',
                    isExclusionTag: false,
                    isAssignable: true,
                },
            ],
        },
    ];

    const windowHeight = useGetWindowHeight();

    const pxInVh = Math.round((windowHeight * 60) / 100);

    return (
        <Box sx={{ display: 'flex', height: '60vh', backgroundColor: 'white', padding: '20px' }}>
            <Box>
                <FixedSizeList
                    height={pxInVh}
                    itemCount={stubs.length}
                    width={280}
                    itemSize={90}
                    itemKey={(index, data) => data.stubs[index]?.id}
                    itemData={{
                        stubs: stubs,
                        selectedStubId: '1',
                        onSetSelectedStub: () => {},
                    }}
                    layout="vertical"
                    overscanCount={3}
                >
                    {CurationDialogFixedSizeListRow}
                </FixedSizeList>
            </Box>
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                <EditableStubSummary onMoveToNextStub={() => {}} columnIndex={0} stub={stubs[0]} />
            </Box>
        </Box>
    );
};

export default CurateStudies;
