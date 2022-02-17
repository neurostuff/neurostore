/**
 * file that handles navbar models and enums
 */

export interface NavOptionsModel {
    label: string;
    path: string;
    disabled?: boolean;
    authenticationRequired?: boolean;
    children: NavOptionsModel[] | null;
}

export interface NavbarArgs {
    navOptions: NavOptionsModel[];
    login: () => void;
    logout: () => void;
}
