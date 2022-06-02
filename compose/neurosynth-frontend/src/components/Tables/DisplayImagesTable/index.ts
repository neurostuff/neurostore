import { ImageApiResponse } from '../../../utils/api';

export interface DisplayImagesTableModel {
    images: ImageApiResponse[] | undefined;
    initialSelectedImage: ImageApiResponse | undefined;
    onSelectImage: (selectedImage: ImageApiResponse | undefined) => void;
}

export interface DisplayImagesTableRowModel {
    onRowSelect: (selectedImage: ImageApiResponse | undefined) => void;
    image: ImageApiResponse;
    active: boolean;
}
