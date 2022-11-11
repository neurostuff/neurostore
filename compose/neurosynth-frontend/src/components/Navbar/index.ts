/**
 * file that handles navbar models and enums
 */

export interface NavOptionsModel {
    label: string;
    path: string;
    disabled?: boolean;
    authenticationRequired?: boolean;
    className?: string;
    children: NavOptionsModel[] | null;
}
