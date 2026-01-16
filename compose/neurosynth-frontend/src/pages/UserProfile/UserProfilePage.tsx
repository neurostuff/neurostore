import { LocalStorageCache, useAuth0 } from '@auth0/auth0-react';
import { Avatar, Typography } from '@mui/material';
import { Box } from '@mui/system';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import { useEffect, useState } from 'react';
import useSendResetPasswordEmail from './hooks/useSendResetPasswordEmail';
import { useSnackbar } from 'notistack';
import LoadingButton from 'components/Buttons/LoadingButton';

const UserProfilePage: React.FC = () => {
    const { user } = useAuth0();
    const [refreshToken, setRefreshToken] = useState('');
    const { mutate: sendResetPasswordEmail, isLoading } = useSendResetPasswordEmail();
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        const localStorageCache = new LocalStorageCache();
        const keys = localStorageCache.allKeys();
        if (keys.length === 0) {
            setRefreshToken('');
        } else {
            const auth0Res = localStorageCache.get<{ body?: { refresh_token?: string } }>(keys[0]);
            setRefreshToken(auth0Res?.body?.refresh_token || '');
        }
    }, []);

    const handleResetPassword = () => {
        const userEmail = user?.email;
        if (!userEmail) {
            enqueueSnackbar('User email not found', { variant: 'error' });
            return;
        }
        sendResetPasswordEmail(userEmail, {
            onSuccess: () => {
                enqueueSnackbar('Reset password email sent', { variant: 'success' });
            },
            onError: () => {
                enqueueSnackbar('Error sending reset password email', { variant: 'error' });
            },
        });
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
                <Avatar src={user?.picture} sx={{ width: 60, height: 60 }} />
                <Box sx={{ marginLeft: '1rem' }}>
                    <Typography variant="h5">{user?.name ?? user?.nickname}</Typography>
                    <Typography variant="body1" color="text.secondary">
                        {user?.email}
                    </Typography>
                </Box>
            </Box>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: '150px 1fr',
                    gap: '1rem',
                }}
            >
                <Typography variant="h6" sx={{ width: '150px', display: 'inline-block' }}>
                    User:
                </Typography>
                <Typography sx={{ display: 'inline' }} variant="h6">
                    {user?.name ?? user?.nickname}
                </Typography>

                <Typography variant="h6" sx={{ width: '150px', display: 'inline-block' }}>
                    Email:
                </Typography>
                <Typography sx={{ display: 'inline' }} variant="h6">
                    {user?.email}
                </Typography>

                <Box sx={{ gridColumn: 'span 2', width: '100%' }}>
                    <LoadingButton
                        isLoading={isLoading}
                        loaderColor="secondary"
                        sx={{ width: '160px' }}
                        text="Reset Password"
                        variant="contained"
                        disableElevation
                        onClick={handleResetPassword}
                    />
                </Box>
            </Box>
            <Box mt={4}>
                {refreshToken && (
                    <NeurosynthAccordion
                        TitleElement={<Typography variant="h6">Advanced</Typography>}
                        expandIconColor="black"
                    >
                        <Typography variant="body2" mb={1}>
                            Refresh Token
                        </Typography>
                        <CodeSnippet linesOfCode={[refreshToken]} />
                    </NeurosynthAccordion>
                )}
            </Box>
        </Box>
    );
};

export default UserProfilePage;
