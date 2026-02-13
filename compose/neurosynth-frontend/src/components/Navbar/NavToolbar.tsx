import { useAuth0 } from '@auth0/auth0-react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, Toolbar, Typography } from '@mui/material';
import CreateProjectButton from 'components/Buttons/CreateProjectButton';
import NeurosynthAvatar from 'components/Navbar/NeurosynthAvatar';
import { useSnackbar } from 'notistack';
import { NavLink, useNavigate } from 'react-router-dom';
import NavToolbarPopupSubMenu from './NavToolbarPopupSubMenu';
import { INav } from './Navbar';
import NavbarStyles from './Navbar.styles';
import NavToolbarStyles from './NavToolbar.styles';

type CitationFormat = 'apa' | 'vancouver' | 'harvard1' | 'bibtex';

const FORMAT_LABELS: Record<CitationFormat, string> = {
    apa: 'APA',
    bibtex: 'BibTeX',
    vancouver: 'Vancouver',
    harvard1: 'Harvard',
};

const CITATION_DOIS = ['10.1162/IMAG.a.1114', '10.52294/001c.87681'];

let citationPayload: Record<CitationFormat, string> | undefined;
let citationPayloadPromise: Promise<Record<CitationFormat, string>> | undefined;

const getCitationPayload = async () => {
    if (citationPayload) {
        return citationPayload;
    }

    if (!citationPayloadPromise) {
        citationPayloadPromise = (async () => {
            // @ts-expect-error citation-js packages do not provide first-party TS types
            const citationCore = await import('@citation-js/core');
            // @ts-expect-error citation-js packages do not provide first-party TS types
            await import('@citation-js/plugin-bibtex');
            // @ts-expect-error citation-js packages do not provide first-party TS types
            await import('@citation-js/plugin-csl');
            // @ts-expect-error citation-js packages do not provide first-party TS types
            await import('@citation-js/plugin-doi');

            const citations = await citationCore.Cite.async(CITATION_DOIS);
            const formattedPayload: Record<CitationFormat, string> = {
                apa: String(citations.format('bibliography', { format: 'text', template: 'apa', lang: 'en-US' })).trim(),
                vancouver: String(
                    citations.format('bibliography', { format: 'text', template: 'vancouver', lang: 'en-US' })
                ).trim(),
                harvard1: String(
                    citations.format('bibliography', { format: 'text', template: 'harvard1', lang: 'en-US' })
                ).trim(),
                bibtex: String(citations.format('bibtex', { format: 'text' })).trim(),
            };

            citationPayload = formattedPayload;
            return formattedPayload;
        })().catch((error) => {
            citationPayloadPromise = undefined;
            throw error;
        });
    }

    return citationPayloadPromise;
};

const copyToClipboard = async (text: string) => {
    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (!copied) {
        throw new Error('Unable to copy text');
    }
};

const NavToolbar: React.FC<INav> = (props) => {
    const { isAuthenticated } = useAuth0();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const copyCitations = async (format: CitationFormat) => {
        try {
            const formattedPayload = await getCitationPayload();
            await copyToClipboard(formattedPayload[format]);
            enqueueSnackbar(`Copied ${FORMAT_LABELS[format]} citations`, { variant: 'success' });
        } catch {
            enqueueSnackbar('Unable to copy citations', { variant: 'error' });
        }
    };

    return (
        <Toolbar disableGutters>
            <Box sx={NavbarStyles.toolbar}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box component={NavLink} to="/" sx={NavbarStyles.logoContainer}>
                        <Box component="img" sx={NavbarStyles.logo} alt="neurosynth compose logo" src="/static/synth.png" />
                        <Typography sx={NavbarStyles.logoText}>neurosynth compose</Typography>
                    </Box>
                    <NavToolbarPopupSubMenu
                        buttonProps={{
                            sx: [
                                NavToolbarStyles.menuItemColor,
                                NavToolbarStyles.menuItemPadding,
                                NavToolbarStyles.menuItem,
                            ],
                            endIcon: <KeyboardArrowDownIcon />,
                        }}
                        options={[
                            {
                                label: 'Copy APA citations',
                                onClick: () => copyCitations('apa'),
                            },
                            {
                                label: 'Copy Vancouver citations',
                                onClick: () => copyCitations('vancouver'),
                            },
                            {
                                label: 'Copy Harvard citations',
                                onClick: () => copyCitations('harvard1'),
                            },
                            {
                                label: 'Copy BibTeX citations',
                                onClick: () => copyCitations('bibtex'),
                            },
                        ]}
                        buttonLabel="cite me!"
                    />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {isAuthenticated && (
                        <>
                            <CreateProjectButton />
                            <Button
                                onClick={() => navigate('/projects')}
                                sx={[
                                    NavToolbarStyles.menuItemColor,
                                    NavToolbarStyles.menuItemPadding,
                                    NavToolbarStyles.menuItem,
                                ]}
                            >
                                my projects
                            </Button>
                        </>
                    )}

                    <NavToolbarPopupSubMenu
                        buttonProps={{
                            sx: [
                                NavToolbarStyles.menuItemColor,
                                NavToolbarStyles.menuItemPadding,
                                NavToolbarStyles.menuItem,
                            ],
                            endIcon: <KeyboardArrowDownIcon />,
                        }}
                        options={[
                            {
                                label: 'Studies',
                                onClick: () => navigate('/base-studies'),
                            },
                            {
                                label: 'Meta-Analyses',
                                onClick: () => navigate('/meta-analyses'),
                            },
                        ]}
                        buttonLabel="explore"
                    />

                    <NavToolbarPopupSubMenu
                        buttonProps={{
                            sx: [
                                NavToolbarStyles.menuItemColor,
                                NavToolbarStyles.menuItemPadding,
                                NavToolbarStyles.menuItem,
                            ],
                            endIcon: <KeyboardArrowDownIcon />,
                        }}
                        options={[
                            {
                                label: (
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        Documentation <OpenInNewIcon fontSize="small" sx={{ ml: 1 }} />
                                    </Box>
                                ),
                                onClick: () => window.open('https://neurostuff.github.io/compose-docs/', '_blank'),
                            },
                            {
                                label: 'Get Help',
                                onClick: () => navigate('/help'),
                            },
                        ]}
                        buttonLabel="help"
                    />
                    <NeurosynthAvatar onLogout={props.onLogout} onLogin={props.onLogin} />
                </Box>
            </Box>
        </Toolbar>
    );
};

export default NavToolbar;
