/**
 * file that handles edit metadata models and enums
 */

import { DisplayMetadataTableRowModel } from '..';

export interface IEditMetadataModel {
    metadata: DisplayMetadataTableRowModel[];
    onMetadataEditChange: (metadata: DisplayMetadataTableRowModel[]) => void;
}

export interface IAddMetadataRowModel {
    onAddMetadataRow: (row: DisplayMetadataTableRowModel) => boolean;
}

export interface IEditMetadataRowModel {
    metadataValueType: EPropertyType;
    metadataRow: DisplayMetadataTableRowModel;
    onMetadataRowEdit: (metadataRow: DisplayMetadataTableRowModel) => void;
    onMetadataRowDelete: (metadataRow: DisplayMetadataTableRowModel) => void;
}

export interface IEditMetadataField {
    onEdit: (newValue: string | number | boolean) => void;
    value: string | number | boolean;
}

export interface IToggleTypeModel {
    onToggle: (type: EPropertyType) => void;
    type: EPropertyType;
}

export enum EPropertyType {
    NONE = 'none',
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
}
