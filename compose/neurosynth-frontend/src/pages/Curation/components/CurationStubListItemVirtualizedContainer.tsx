import { ListChildComponentProps } from 'react-window';
import { ICurationStubStudy } from '../Curation.types';
import CurationStubListItem from './CurationStubListItem';

const CurationStubListItemVirtualizedContainer: React.FC<
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

export default CurationStubListItemVirtualizedContainer;
