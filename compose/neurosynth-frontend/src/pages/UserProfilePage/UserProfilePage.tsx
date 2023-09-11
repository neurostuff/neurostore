import { useAuth0 } from '@auth0/auth0-react';
import { Avatar, Typography } from '@mui/material';
import { Box } from '@mui/system';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';

const UserProfilePage: React.FC = (props) => {
    const { user } = useAuth0();

    console.log(user);

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

                <Typography
                    gutterBottom
                    variant="h6"
                    sx={{ width: '150px', display: 'inline-block' }}
                >
                    Refresh Token:
                </Typography>
                <CodeSnippet
                    linesOfCode={[
                        'q9tbn34387gb8i4478ias34bga8ib3487gbai384gb3ai8gqa3g8ia3gbai48ba38igba3i487gba38i7gba348bgak384gba34834bga387gb4a3478bak487',
                    ]}
                />
            </Box>
        </Box>
    );
};

export default UserProfilePage;
