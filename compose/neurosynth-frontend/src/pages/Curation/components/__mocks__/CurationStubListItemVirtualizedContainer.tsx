import { ICurationStubStudy } from 'pages/Curation/Curation.types';

const CurationStubListItemVirtualizedContainer = ({ stub }: { stub: ICurationStubStudy }) => {
    return <div>{stub.id}</div>;
};

export default CurationStubListItemVirtualizedContainer;
