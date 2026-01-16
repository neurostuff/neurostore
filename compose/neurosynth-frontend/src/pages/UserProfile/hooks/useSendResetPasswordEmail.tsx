import { axiosInstance } from 'api/api.state';
import { useMutation } from 'react-query';

const ENV_DOMAIN = import.meta.env.VITE_APP_AUTH0_DOMAIN;
const ENV_CLIENT_ID = import.meta.env.VITE_APP_AUTH0_CLIENT_ID;

function useSendResetPasswordEmail() {
    return useMutation({
        mutationFn: (email: string) =>
            axiosInstance.post(
                `https://${ENV_DOMAIN}/dbconnections/change_password`,
                {
                    client_id: ENV_CLIENT_ID,
                    email: email,
                    connection: 'Username-Password-Authentication',
                },
                {
                    headers: {
                        'content-type': 'application/json',
                    },
                }
            ),
    });
}

export default useSendResetPasswordEmail;
