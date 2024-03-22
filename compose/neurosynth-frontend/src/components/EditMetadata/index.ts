/**
 * file that handles edit metadata models and enums
 */

export interface IEditMetadataModel {
    keyPlaceholderText?: string;
    valuePlaceholderText?: string;
    metadata: IMetadataRowModel[];
    disabled?: boolean;
    onMetadataRowEdit: (update: IMetadataRowModel) => void;
    onMetadataRowDelete: (update: IMetadataRowModel) => void;
    onMetadataRowAdd: (update: IMetadataRowModel) => boolean;
}

export interface IAddMetadataRowModel {
    allowNone?: boolean;
    allowBoolean?: boolean;
    allowString?: boolean;
    allowNumber?: boolean;
    errorMessage?: string;
    keyPlaceholderText?: string;
    showToggleType?: boolean;
    valuePlaceholderText?: string;
    showMetadataValueInput?: boolean;
    onAddMetadataRow: (row: IMetadataRowModel) => boolean;
    disabled?: boolean;
}

export interface IEditMetadataRowModel {
    disabled?: boolean;
    metadataValueType: EPropertyType;
    metadataRow: IMetadataRowModel;
    onMetadataRowEdit: (metadataRow: IMetadataRowModel) => void;
    onMetadataRowDelete: (metadataRow: IMetadataRowModel) => void;
}

export interface IEditMetadataValue {
    onEditMetadataValue: (newValue: string | number | boolean) => void;
    disabled?: boolean;
    placeholderText?: string;
    type: EPropertyType;
    value: string | number | boolean;
}

export interface IToggleTypeModel {
    onToggle: (type: EPropertyType) => void;
    allowNone?: boolean;
    type: EPropertyType;
    allowString?: boolean;
    allowNumber?: boolean;
    allowBoolean?: boolean;
    disabled?: boolean;
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

export const getType = (value: any): EPropertyType => {
    switch (typeof value) {
        case EPropertyType.BOOLEAN:
            return EPropertyType.BOOLEAN;
        case EPropertyType.STRING:
            return EPropertyType.STRING;
        case EPropertyType.NUMBER:
            return EPropertyType.NUMBER;
        default:
            return EPropertyType.NONE;
    }
};
