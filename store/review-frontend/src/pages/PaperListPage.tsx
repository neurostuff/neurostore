import { AppBar, Container, List, ListItemButton, ListItemText, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { usePapers } from '../api/context';
import { Brand } from '../Brand';
import { WhenLoaded } from './WhenLoaded';

export function PaperListPage() {
    const papers = usePapers();
    return (
        <>
            <AppBar position="static" elevation={0}>
                <Toolbar variant="dense">
                    <Brand />
                </Toolbar>
            </AppBar>
            <Container maxWidth="md" sx={{ py: 3 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Papers
                </Typography>
                <WhenLoaded query={papers}>
                    {(list) => (
                        <List>
                            {list.map((paper) => (
                                <ListItemButton key={paper.id} component={RouterLink} to={`/papers/${paper.id}`}>
                                    <ListItemText primary={paper.label} secondary={paper.id} />
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </WhenLoaded>
            </Container>
        </>
    );
}
