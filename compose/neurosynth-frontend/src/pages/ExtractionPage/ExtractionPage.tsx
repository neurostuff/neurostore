import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import OutlinedInput from '@mui/material/OutlinedInput';
import SearchIcon from '@mui/icons-material/Search';
import { Chip, Typography, IconButton, InputLabel } from '@mui/material';
import BackButton from 'components/Buttons/BackButton/BackButton';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import { useHistory } from 'react-router-dom';

const ExtractionPage: React.FC = (props) => {
    const history = useHistory();

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ width: '800px' }}>
                <Box sx={{ marginBottom: '1rem' }}>
                    <BackButton
                        sx={{ fontSize: 'inherit' }}
                        path="/projects/1"
                        text="Back"
                        color="secondary"
                        variant="outlined"
                    />
                </Box>
                <Box sx={{ marginBottom: '1rem' }}>
                    <Typography variant="h4" color="primary">
                        Studyset name
                    </Typography>
                    <Typography sx={{ color: 'muted.main' }}>
                        Lorem ipsum dolor sit amet consectetur, adipisicing elit. Non, doloribus ex
                        atque sit rem necessitatibus minima unde harum exercitationem quas, autem
                        alias quidem voluptate, corrupti ullam repellat accusantium quia vel.
                    </Typography>
                </Box>
                <Box sx={{ marginBottom: '1rem' }}>
                    <Box sx={{ marginBottom: '1rem' }}>
                        <FormControl sx={{ width: '100%', marginTop: '2px' }}>
                            <InputLabel>search</InputLabel>
                            <OutlinedInput
                                label="search"
                                endAdornment={<SearchIcon color="primary" />}
                            />
                        </FormControl>
                    </Box>
                    <Chip
                        size="medium"
                        onClick={() => {}}
                        variant="outlined"
                        color="success"
                        sx={{ marginRight: '8px' }}
                        icon={<CheckCircleOutlineIcon />}
                        label="Completed"
                    />
                    <Chip
                        size="medium"
                        onClick={() => {}}
                        sx={{
                            marginRight: '8px',
                            color: 'warning.dark',
                            borderColor: 'warning.dark',
                        }}
                        variant="outlined"
                        label="Uncategorized"
                    />
                    <Chip
                        size="medium"
                        onClick={() => {}}
                        variant="outlined"
                        sx={{
                            color: 'muted.main',
                            borderColor: 'muted.main',
                        }}
                        icon={<AccessTimeIcon sx={{ color: '#9e9e9e !important' }} />}
                        label="Save for later"
                    />
                </Box>

                <Box>
                    <Box
                        sx={{
                            display: 'flex',
                            marginBottom: '0.5rem',
                            alignItems: 'center',
                            padding: '1rem',
                            ':hover': {
                                backgroundColor: '#efefef',
                                transition: '0.5s ease',
                                borderRadius: '8px',
                                cursor: 'pointer',
                            },
                        }}
                        onClick={() => {
                            history.push('/studies/4XBUtciFz9pv/edit');
                        }}
                    >
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" color="primary">
                                Traumatic Brain Injury: An Overview of Epidemiology,
                                Pathophysiology, and Medical Management
                            </Typography>
                            <Typography color="secondary">
                                Allison Capizzi, Jean Woo, Monica Verduzco-Gutierrez
                            </Typography>
                            <Box sx={{ display: 'flex' }}>
                                <Typography
                                    variant="caption"
                                    sx={{ marginRight: '2rem', color: 'muted.main' }}
                                >
                                    PMID: 32035565
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'muted.main' }}>
                                    DOI: 10.1016/j.mcna.2019.11.001
                                </Typography>
                            </Box>
                            <TextExpansion
                                textSx={{ color: 'muted.main' }}
                                text="Traumatic brain injury (TBI) is an acquired insult to the brain from an external mechanical force that may result in temporary or permanent impairment. The goal of this article is to provide a general review of the epidemiology, pathophysiology and medical management of adult patients with TBI for providers practicing outside the field of physical medicine and rehabilitation. The medical and rehabilitation management of moderate to severe TBI is the focus of this article, with a brief discussion of the management of mild injuries."
                            />
                        </Box>
                        <Box sx={{ width: '100px' }}>
                            <IconButton>
                                <CheckCircleOutlineIcon color="success" />
                            </IconButton>
                            <IconButton>
                                <AccessTimeIcon sx={{ color: 'muted.main' }} />
                            </IconButton>
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            marginBottom: '0.5rem',
                            alignItems: 'center',
                            padding: '1rem',
                            ':hover': {
                                backgroundColor: '#efefef',
                                transition: '0.5s ease',
                                borderRadius: '8px',
                                cursor: 'pointer',
                            },
                        }}
                        onClick={() => {
                            history.push('/studies/4XBUtciFz9pv/edit');
                        }}
                    >
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" color="primary">
                                A review of seizures and epilepsy following traumatic brain injury
                            </Typography>
                            <Typography color="secondary">
                                Surina Fordington, Mark Manford
                            </Typography>
                            <Box sx={{ display: 'flex' }}>
                                <Typography
                                    variant="caption"
                                    sx={{ marginRight: '2rem', color: 'muted.main' }}
                                >
                                    PMID: 32444981
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'muted.main' }}>
                                    DOI: 10.1007/s00415-020-09926-w
                                </Typography>
                            </Box>
                            <TextExpansion
                                textSx={{ color: 'muted.main' }}
                                text="Traumatic brain injury (TBI) is one of the commonest presentations to emergency departments and is associated with seizures carrying different significance at different stages following injury. We describe the epidemiology of early and late seizures following TBI, the significance of intracranial haemorrhage of different types in the risk of later epilepsy and the gaps in current understanding of risk factors contributing to the risk of post-traumatic epilepsy (PTE). The delay from injury to epilepsy presents an opportunity to understand the mechanisms underlying changes in the brain and how they may reveal potential targets for anti-epileptogenic therapy. We review existing treatments, both medical and surgical and conclude that current research is not tailored to differentiate between PTE and other forms of focal epilepsy. Finally, we review the increasing understanding of the frequency and significance of dissociative seizures following mild TBI."
                            />
                        </Box>
                        <Box sx={{ width: '100px' }}>
                            <IconButton>
                                <CheckCircleOutlineIcon color="success" />
                            </IconButton>
                            <IconButton>
                                <AccessTimeIcon sx={{ color: 'muted.main' }} />
                            </IconButton>
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            marginBottom: '0.5rem',
                            alignItems: 'center',
                            padding: '1rem',
                            ':hover': {
                                backgroundColor: '#efefef',
                                transition: 'all 0.5s ease-in',
                                borderRadius: '8px',
                                cursor: 'pointer',
                            },
                        }}
                        onClick={() => {
                            history.push('/studies/4XBUtciFz9pv/edit');
                        }}
                    >
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" color="primary">
                                Recent advances in traumatic brain injury.
                            </Typography>
                            <Typography color="secondary">
                                Abdelhakim Khellaf, Danyal Zaman Khan, Adel Helmy
                            </Typography>
                            <Box sx={{ display: 'flex' }}>
                                <Typography
                                    variant="caption"
                                    sx={{ marginRight: '2rem', color: 'muted.main' }}
                                >
                                    PMID: 31563989
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'muted.main' }}>
                                    DOI: 10.1007/s00415-019-09541-4
                                </Typography>
                            </Box>
                            <TextExpansion
                                textSx={{ color: 'muted.main' }}
                                text="Traumatic brain injury (TBI) is the most common cause of death and disability in those aged under 40 years in the UK. Higher rates of morbidity and mortality are seen in low-income and middle-income countries making it a global health challenge. There has been a secular trend towards reduced incidence of severe TBI in the first world, driven by public health interventions such as seatbelt legislation, helmet use, and workplace health and safety regulations. This has paralleled improved outcomes following TBI delivered in a large part by the widespread establishment of specialised neurointensive care. This update will focus on three key areas of advances in TBI management and research in moderate and severe TBI: refining neurointensive care protocolized therapies, the recent evidence base for decompressive craniectomy and novel pharmacological therapies. In each section, we review the developing evidence base as well as exploring future trajectories of TBI research."
                            />
                        </Box>
                        <Box sx={{ width: '100px' }}>
                            <IconButton>
                                <CheckCircleOutlineIcon color="success" />
                            </IconButton>
                            <IconButton>
                                <AccessTimeIcon sx={{ color: 'muted.main' }} />
                            </IconButton>
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            marginBottom: '0.5rem',
                            alignItems: 'center',
                            padding: '1rem',
                            ':hover': {
                                backgroundColor: '#efefef',
                                transition: '0.5s ease',
                                borderRadius: '8px',
                                cursor: 'pointer',
                            },
                        }}
                        onClick={() => {
                            history.push('/studies/4XBUtciFz9pv/edit');
                        }}
                    >
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" color="primary">
                                Paediatric traumatic brain injury
                            </Typography>
                            <Typography color="secondary">Ian C Coulter, Rob J Forsyth</Typography>
                            <Box sx={{ display: 'flex' }}>
                                <Typography
                                    variant="caption"
                                    sx={{ marginRight: '2rem', color: 'muted.main' }}
                                >
                                    PMID: 31693586
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'muted.main' }}>
                                    DOI: 10.1097/MOP.0000000000000820
                                </Typography>
                            </Box>
                            <TextExpansion
                                textSx={{ color: 'muted.main' }}
                                text="
                                    PURPOSE OF REVIEW
                                    To provide a summary of recent developments in the field of paediatric traumatic brain injury (TBI).
                                    RECENT FINDINGS
                                    The epidemiology of paediatric TBI with falling rates of severe TBI, and increasing presentations of apparently minor TBI. There is growing interest in the pathophysiology and outcomes of concussion in children, and detection of 'significant' injury, arising from concern about risks of long-term chronic traumatic encephalopathy. The role of decompressive craniectomy in children is still clarifying.
                                    SUMMARY
                                    Paediatric TBI remains a major public health issue."
                            />
                        </Box>
                        <Box sx={{ width: '100px' }}>
                            <IconButton>
                                <CheckCircleOutlineIcon color="success" />
                            </IconButton>
                            <IconButton>
                                <AccessTimeIcon sx={{ color: 'muted.main' }} />
                            </IconButton>
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            marginBottom: '0.5rem',
                            alignItems: 'center',
                            padding: '1rem',
                            ':hover': {
                                backgroundColor: '#efefef',
                                transition: '0.5s ease',
                                borderRadius: '8px',
                                cursor: 'pointer',
                            },
                        }}
                        onClick={() => {
                            history.push('/studies/4XBUtciFz9pv/edit');
                        }}
                    >
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" color="primary">
                                Treatments and rehabilitation in the acute and chronic state of
                                traumatic brain injury.
                            </Typography>
                            <Typography color="secondary">
                                N Marklund, B-M Bellander, A K Godbolt, H Levin, P McCrory, E P
                                Thelin
                            </Typography>
                            <Box sx={{ display: 'flex' }}>
                                <Typography
                                    variant="caption"
                                    sx={{ marginRight: '2rem', color: 'muted.main' }}
                                >
                                    PMID: 30883980
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'muted.main' }}>
                                    DOI: 10.1111/joim.12900
                                </Typography>
                            </Box>
                            <TextExpansion
                                textSx={{ color: 'muted.main' }}
                                text="Traumatic brain injury (TBI) is a major cause of acquired disability globally, and effective treatment methods are scarce. Lately, there has been increasing recognition of the devastating impact of TBI resulting from sports and other recreational activities, ranging from primarily sport-related concussions (SRC) but also more severe brain injuries requiring hospitalization. There are currently no established treatments for the underlying pathophysiology in TBI and while neuro-rehabilitation efforts are promising, there are currently is a lack of consensus regarding rehabilitation following TBI of any severity. In this narrative review, we highlight short- and long-term consequences of SRCs, and how the sideline management of these patients should be performed. We also cover the basic concepts of neuro-critical care management for more severely brain-injured patients with a focus on brain oedema and the necessity of improving intracranial conditions in terms of substrate delivery in order to facilitate recovery and improve outcome. Further, following the acute phase, promising new approaches to rehabilitation are covered for both patients with severe TBI and athletes suffering from SRC. These highlight the need for co-ordinated interdisciplinary rehabilitation, with a special focus on cognition, in order to promote recovery after TBI."
                            />
                        </Box>
                        <Box sx={{ width: '100px' }}>
                            <IconButton>
                                <CheckCircleOutlineIcon color="success" />
                            </IconButton>
                            <IconButton>
                                <AccessTimeIcon sx={{ color: 'muted.main' }} />
                            </IconButton>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default ExtractionPage;
