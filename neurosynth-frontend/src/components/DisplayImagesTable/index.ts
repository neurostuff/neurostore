import { ReadOnly, Image } from '../../gen/api';

export interface DisplayImagesTableRowModel {
    onRowSelect: (selectedImage: (Image & ReadOnly) | undefined) => void;
    image: Image & ReadOnly;
    active: boolean;
}
