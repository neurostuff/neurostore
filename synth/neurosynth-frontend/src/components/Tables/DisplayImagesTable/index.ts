import { ReadOnly, Image } from '../../../gen/api';

export interface DisplayImagesTableModel {
    images: (Image & ReadOnly)[] | undefined;
    initialSelectedImage: (Image & ReadOnly) | undefined;
    onSelectImage: (selectedImage: (Image & ReadOnly) | undefined) => void;
}

export interface DisplayImagesTableRowModel {
    onRowSelect: (selectedImage: (Image & ReadOnly) | undefined) => void;
    image: Image & ReadOnly;
    active: boolean;
}
