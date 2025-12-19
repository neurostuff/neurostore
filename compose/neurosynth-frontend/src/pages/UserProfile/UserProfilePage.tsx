import { LocalStorageCache, useAuth0 } from '@auth0/auth0-react';
import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import { useEffect, useState } from 'react';

const UserProfilePage: React.FC = () => {
    const { user } = useAuth0();
    const [refreshToken, setRefreshToken] = useState('');

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

    return (
        <Box>
            <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
                <Typography variant="h4">User Profile</Typography>
            </Box>
            <Box>
                <Typography variant="h6" sx={{ width: '150px', display: 'inline-block' }}>
                    User:
                </Typography>
                <Typography sx={{ display: 'inline' }} variant="h6">
                    {user?.name}
                </Typography>
                <br />

                <Typography variant="h6" sx={{ width: '150px', display: 'inline-block' }}>
                    Email:
                </Typography>
                <Typography sx={{ display: 'inline' }} variant="h6">
                    {user?.email}
                </Typography>
                <br />
                <br />

                {refreshToken && (
                    <NeurosynthAccordion
                        TitleElement={<Typography variant="h6">Refresh Token</Typography>}
                        expandIconColor="black"
                    >
                        <CodeSnippet linesOfCode={[refreshToken]} />
                    </NeurosynthAccordion>
                )}
            </Box>
        </Box>
    );
};

export default UserProfilePage;
