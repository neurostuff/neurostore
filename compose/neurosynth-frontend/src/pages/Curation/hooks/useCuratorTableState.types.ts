import { SortingColumnDef } from '@tanstack/react-table';
import {
    EAIExtractors,
    IParticipantDemographicExtractor,
    ITaskExtractor,
} from 'hooks/extractions/useGetAllExtractedData';
import { ICurationStubStudy } from '../Curation.types';

export interface IGenericCustomAccessorReturn {
    key: string;
    value: number | string | boolean | null | undefined | string[];
}

export type ICurationTableColumnType = IGenericCustomAccessorReturn[] | string | number | string[];

export interface ICurationBoardAIInterfaceCuratorColumnType {
    id: string;
    label: string;
    description?: string;
    AIExtractor?: EAIExtractors;
    filterVariant?: 'text' | 'numeric' | 'autocomplete';
    canSort: boolean;
    sortingFn?: SortingColumnDef<ICurationTableStudy>['sortingFn'];
    size?: number;
    customAccessor?: (stub: ICurationTableStudy) => ICurationTableColumnType | null;
}

export type ICurationTableStudy = ICurationStubStudy & {
    [EAIExtractors.TASKEXTRACTOR]: ITaskExtractor | null;
    [EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]: IParticipantDemographicExtractor | null;
};
