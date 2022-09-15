import { ImageReturn } from 'neurostore-typescript-sdk';

export interface DisplayImagesTableModel {
    images: ImageReturn[] | undefined;
    initialSelectedImage: ImageReturn | undefined;
    onSelectImage: (selectedImage: ImageReturn | undefined) => void;
}

export interface DisplayImagesTableRowModel {
    onRowSelect: (selectedImage: ImageReturn | undefined) => void;
    image: ImageReturn;
    active: boolean;
}
