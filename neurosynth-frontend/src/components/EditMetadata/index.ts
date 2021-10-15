/**
 * file that handles edit metadata models and enums
 */

export interface IEditMetadataModel {
    metadata: IMetadataRowModel[];
    onMetadataEditChange: (metadata: IMetadataRowModel[]) => void;
}

export interface IAddMetadataRowModel {
    onAddMetadataRow: (row: IMetadataRowModel) => boolean;
}

export interface IEditMetadataRowModel {
    metadataValueType: EPropertyType;
    metadataRow: IMetadataRowModel;
    onMetadataRowEdit: (metadataRow: IMetadataRowModel) => void;
    onMetadataRowDelete: (metadataRow: IMetadataRowModel) => void;
}

export interface IEditMetadataField {
    onEdit: (newValue: string | number | boolean) => void;
    value: string | number | boolean;
}

export interface IToggleTypeModel {
    onToggle: (type: EPropertyType) => void;
    type: EPropertyType;
}

export interface IMetadataRowModel {
    metadataKey: string;
    metadataValue: any;
}

export enum EPropertyType {
    NONE = 'none',
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
}
