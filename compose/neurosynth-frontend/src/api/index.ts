import { LogoutOptions } from '@auth0/auth0-react';
import './api.config';
import './api.state';
import { _setAccessTokenSilentlyFunc, _setLogoutFunc } from './api.state';
import './axios.config';

export const initAPISetAccessTokenFunc = (getAccessTokenSilently: () => Promise<string>) => {
    _setAccessTokenSilentlyFunc(getAccessTokenSilently);
};

export const initAPISetLogoutFunc = (logout: (opts?: LogoutOptions) => void) => {
    _setLogoutFunc(logout);
};
