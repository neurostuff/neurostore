/**
 * file that handles navbar models and enums
 */

export interface NavOptionsModel {
    label: JSX.Element | string;
    path: string;
    disabled?: boolean;
    authenticationRequired?: boolean;
    className?: string;
    children: NavOptionsModel[] | null;
}

export interface NavbarArgs {
    // navOptions: NavOptionsModel[];
    login: () => void;
    logout: () => void;
}
