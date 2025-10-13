import { Check, CheckCircle, Checklist, Remove, RemoveCircleOutline } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
    Box,
    Breadcrumbs,
    Button,
    Chip,
    FormControl,
    FormControlLabel,
    Icon,
    IconButton,
    InputBase,
    Link,
    OutlinedInput,
    Paper,
    Radio,
    RadioGroup,
    Slider,
    Typography,
} from '@mui/material';
import { TreeViewBaseItem } from '@mui/x-tree-view';
import { StudyReturn } from 'neurostore-typescript-sdk';
import TreeView from './components/TreeView';

const brainRegionsItems: TreeViewBaseItem[] = [
    {
        id: '1',
        label: 'Brain Networks',
        children: [
            { id: '1.1', label: 'Central executive network' },
            { id: '1.2', label: 'Default mode network' },
            { id: '1.3', label: 'Dorsal attention network' },
            { id: '1.4', label: 'Frontoparietal network' },
            { id: '1.5', label: 'Limbic network' },
            { id: '1.6', label: 'Salience network' },
            { id: '1.7', label: 'Sensorimotor network' },
            { id: '1.8', label: 'Visual cortex' },
        ],
    },
    {
        id: '2',
        label: 'Cortical Regions',
        children: [
            { id: '2.1', label: 'Anterior ascending ramus of the lateral sulcus' },
            { id: '2.2', label: 'Anterior horizontal ramus of the lateral sulcus' },
            { id: '2.3', label: 'Anterior occipital sulcus' },
            { id: '2.4', label: 'Auditory cortex' },
            { id: '2.5', label: 'Banks of superior temporal sulcus' },
            { id: '2.6', label: 'Calcarine sulcus' },
            { id: '2.7', label: 'Callosal sulcus' },
            { id: '2.8', label: 'Caudal anterior cingulate cortex' },
            { id: '2.9', label: 'Caudal superior temporal sulcus, first segment' },
            { id: '2.10', label: 'Caudal superior temporal sulcus, second segment' },
            { id: '2.11', label: 'Caudal superior temporal sulcus, third segment' },
            { id: '2.12', label: 'Central sulcus' },
            { id: '2.13', label: 'Cingulate sulcus' },
            { id: '2.14', label: 'Circular insular sulcus' },
            { id: '2.15', label: 'Collateral sulcus' },
            { id: '2.16', label: 'Cuneus' },
            { id: '2.17', label: 'Dorsal prefrontal cortex' },
            { id: '2.18', label: 'Entorhinal cortex' },
            { id: '2.19', label: 'First transverse temporal sulcus' },
            { id: '2.20', label: 'Frontal pole' },
            { id: '2.21', label: 'Frontomarginal sulcus' },
            { id: '2.22', label: 'Fusiform gyrus' },
            { id: '2.23', label: "Heschl's sulcus" },
            { id: '2.24', label: 'Inferior Frontal Gyrus' },
            { id: '2.25', label: 'Inferior frontal sulcus' },
            { id: '2.26', label: 'Inferior parietal lobule' },
            { id: '2.27', label: 'Inferior temporal sulcus' },
            { id: '2.28', label: 'Insula' },
            { id: '2.29', label: 'Interhemispheric sulcus' },
            { id: '2.30', label: 'Intraparietal sulcus' },
            { id: '2.31', label: 'Isthmus cingulate cortex' },
            { id: '2.32', label: 'Lateral H-shaped orbital sulcus' },
            { id: '2.33', label: 'Lateral occipital cortex' },
            { id: '2.34', label: 'Lateral occipital sulcus' },
            { id: '2.35', label: 'Lateral orbitofrontal cortex' },
            { id: '2.36', label: 'Lateral sulcus' },
            { id: '2.37', label: 'Lingual gyrus' },
            { id: '2.38', label: 'Medial H-shaped orbital sulcus' },
            { id: '2.39', label: 'Medial orbitofrontal cortex' },
            { id: '2.40', label: 'Middle frontal gyrus' },
            { id: '2.41', label: 'Occipitotemporal sulcus' },
            { id: '2.42', label: 'Olfactory sulcus' },
            { id: '2.43', label: 'Paracentral lobule' },
            { id: '2.44', label: 'Paracentral sulcus' },
            { id: '2.45', label: 'Parahippocampal gyrus' },
            { id: '2.46', label: 'Parietooccipital sulcus' },
            { id: '2.47', label: 'Pericalcarine cortex' },
            { id: '2.48', label: 'Postcentral gyrus' },
            { id: '2.49', label: 'Postcentral sulcus' },
            { id: '2.50', label: 'Posterior ascending ramus of the lateral sulcus' },
            { id: '2.51', label: 'Posterior cingulate cortex' },
            { id: '2.52', label: 'Posterior horizontal ramus of the lateral sulcus' },
            { id: '2.53', label: 'Precentral gyrus' },
            { id: '2.54', label: 'Precentral sulcus' },
            { id: '2.55', label: 'Precuneus' },
            { id: '2.56', label: 'Pretriangular sulcus' },
            { id: '2.57', label: 'Primary intermediate sulcus' },
            { id: '2.58', label: 'Rhinal sulcus' },
            { id: '2.59', label: 'Rostral anterior cingulate cortex' },
            { id: '2.60', label: 'Subparietal sulcus' },
            { id: '2.61', label: 'Superior frontal gyrus' },
            { id: '2.62', label: 'Superior frontal sulcus' },
            { id: '2.63', label: 'Superior parietal lobule' },
            { id: '2.64', label: 'Superior rostral sulcus' },
            { id: '2.65', label: 'Superior temporal gyrus' },
            { id: '2.66', label: 'Superior temporal sulcus' },
            { id: '2.67', label: 'Supramarginal gyrus' },
            { id: '2.68', label: 'Temporal gyrus' },
            { id: '2.69', label: 'Temporal incisure' },
            { id: '2.70', label: 'Temporal pole' },
            { id: '2.71', label: 'Temporo-Parietal Junction' },
            { id: '2.72', label: 'Transverse occipital sulcus' },
            { id: '2.73', label: 'Transverse temporal gyrus' },
            { id: '2.74', label: 'Ventral prefrontal cortex' },
        ],
    },
    {
        id: '3',
        label: 'Subcortical Regions',
        children: [
            { id: '3.1', label: 'Amygdala' },
            { id: '3.2', label: 'Caudate Nucleus' },
            { id: '3.3', label: 'Cerebellum' },
            { id: '3.4', label: 'Extended Amygdala' },
            { id: '3.5', label: 'Globus Pallidus External Segment' },
            { id: '3.6', label: 'Globus Pallidus Internal Segment' },
            { id: '3.7', label: 'Habenular Nucleus' },
            { id: '3.8', label: 'Hippocampus' },
            { id: '3.9', label: 'Hypothalamus' },
            { id: '3.10', label: 'Mammillary Nucleus' },
            { id: '3.11', label: 'Nucleus Accumbens' },
            { id: '3.12', label: 'Parabrachial Pigmented Nucleus' },
            { id: '3.13', label: 'Putamen' },
            { id: '3.14', label: 'Red Nucleus' },
            { id: '3.15', label: 'Substantia Nigra Pars Compacta' },
            { id: '3.16', label: 'Substantia Nigra Pars Reticulata' },
            { id: '3.17', label: 'Subthalamic Nucleus' },
            { id: '3.18', label: 'Thalamus' },
            { id: '3.19', label: 'Ventral Pallidum' },
            { id: '3.20', label: 'Ventral Tegmental Area' },
        ],
    },
];

const disordersAndConditionsItems: TreeViewBaseItem[] = [
    {
        id: '4',
        label: 'Medical',
        children: [
            { id: '4.1', label: 'Amblyopia' },
            { id: '4.2', label: 'Anemia' },
            { id: '4.3', label: 'Aneurysm' },
            { id: '4.4', label: 'Asthma' },
            { id: '4.5', label: 'Brain Tumor' },
            { id: '4.6', label: 'Cancer' },
            { id: '4.7', label: 'Cardiovascular Disease' },
            { id: '4.8', label: 'Chronic Fatigue Syndrome' },
            { id: '4.9', label: 'Chronic Obstructive Pulmonary Disease' },
            { id: '4.10', label: 'Color Blindness' },
            { id: '4.11', label: 'Coronary Artery Disease' },
            { id: '4.12', label: 'Gastroesophageal Reflux Disease' },
            { id: '4.13', label: 'Hepatitis B Virus' },
            { id: '4.14', label: 'Hepatitis C Virus' },
            { id: '4.15', label: 'Human Immunodeficiency Virus' },
            { id: '4.16', label: 'Hyperlipidemia' },
            { id: '4.17', label: 'Hypertension' },
            { id: '4.18', label: 'Hyperthyroidism' },
            { id: '4.19', label: 'Hypothyroidism' },
            { id: '4.20', label: 'Kidney Disease' },
            { id: '4.21', label: 'Liver Disease' },
            { id: '4.22', label: 'Obesity' },
            { id: '4.23', label: 'Osteoarthritis' },
            { id: '4.24', label: 'Sepsis' },
            { id: '4.25', label: 'Tetralogy of Fallot' },
            { id: '4.26', label: 'Thyroiditis' },
            { id: '4.27', label: 'Type 1 Diabetes Mellitus' },
            { id: '4.28', label: 'Type 2 Diabetes Mellitus' },
        ],
    },
    {
        id: '5',
        label: 'Neurological',
        children: [
            { id: '5.1', label: "Alzheimer's Disease" },
            { id: '5.2', label: 'Carpal Tunnel Syndrome' },
            { id: '5.3', label: 'Dementia' },
            { id: '5.4', label: 'Down Syndrome' },
            { id: '5.5', label: 'Dyslexia' },
            { id: '5.6', label: 'Epilepsy' },
            { id: '5.7', label: 'Fibromyalgia' },
            { id: '5.8', label: 'Fragile X Syndrome' },
            { id: '5.9', label: 'Headache' },
            { id: '5.10', label: 'Hyperalgesia' },
            { id: '5.11', label: 'Meningioma' },
            { id: '5.12', label: 'Migraine' },
            { id: '5.13', label: 'Motor Neuron Disease' },
            { id: '5.14', label: 'Multiple Sclerosis' },
            { id: '5.15', label: 'Neurodegeneration' },
            { id: '5.16', label: 'Neuroinflammation' },
            { id: '5.17', label: 'Neuropathic Pain' },
            { id: '5.18', label: 'Palsiy' },
            { id: '5.19', label: "Parkinson's Disease" },
            { id: '5.20', label: 'Peripheral Neuropathy' },
            { id: '5.21', label: 'Pituitary Adenoma' },
            { id: '5.22', label: 'Prosopagnosia' },
            { id: '5.23', label: 'Sciatica' },
            { id: '5.24', label: 'Spinocerebellar Ataxia' },
            { id: '5.25', label: 'Stroke' },
        ],
    },
    {
        id: '6',
        label: 'Psychiatric',
        children: [
            { id: '6.1', label: 'Affective Psychotic Disorder' },
            { id: '6.2', label: 'Alexithymia' },
            { id: '6.3', label: 'Anxiety Disorders' },
            { id: '6.4', label: 'Attention-Deficit Hyperactivity Disorder' },
            { id: '6.5', label: 'Autism Spectrum Disorder' },
            { id: '6.6', label: 'Bipolar Disorder' },
            { id: '6.7', label: 'Borderline Personality Disorder' },
            { id: '6.8', label: 'Claustrophobia' },
            { id: '6.9', label: 'Depressive Disorder' },
            { id: '6.10', label: 'Developmental Disorder' },
            { id: '6.11', label: 'Eating Disorders' },
            { id: '6.12', label: 'Grief Disorder' },
            { id: '6.13', label: 'Mood Dysregulation Disorder' },
            { id: '6.14', label: 'Obsessive-Compulsive Disorder' },
            { id: '6.15', label: 'Oppositional Defiant Disorder' },
            { id: '6.16', label: 'Panic Disorder' },
            { id: '6.17', label: 'Personality Disorders' },
            { id: '6.18', label: 'Phobia' },
            { id: '6.19', label: 'Post-Traumatic Stress Disorder' },
            { id: '6.20', label: 'Psychotic Disorder' },
            { id: '6.21', label: 'Schizophrenia' },
            { id: '6.22', label: 'Social Phobia' },
            { id: '6.23', label: 'Substance Use Disorders' },
        ],
    },
];

const drugsAndMedicationsItems: TreeViewBaseItem[] = [
    {
        id: '7',
        label: 'ADHD Medications Nonstimulants',
        children: [
            { id: '7.1', label: 'Atomoxetine' },
            { id: '7.2', label: 'Clonidine' },
            { id: '7.3', label: 'Guanfacine' },
            { id: '7.4', label: 'Viloxazine' },
        ],
    },
    {
        id: '8',
        label: 'Anesthetics',
        children: [
            { id: '8.1', label: 'Desflurane' },
            { id: '8.2', label: 'Enflurane' },
            { id: '8.3', label: 'Isoflurane' },
            { id: '8.4', label: 'Nitrous Oxide' },
            { id: '8.5', label: 'Propofol' },
            { id: '8.6', label: 'Sevoflurane' },
        ],
    },
    {
        id: '9',
        label: 'Anti Inflammatory',
        children: [
            { id: '9.1', label: 'Celecoxib' },
            { id: '9.2', label: 'Diclofenac' },
            { id: '9.3', label: 'Diflunisal' },
            { id: '9.4', label: 'Etodolac' },
            { id: '9.5', label: 'Etoricoxib' },
            { id: '9.6', label: 'Ibuprofen' },
            { id: '9.7', label: 'Indomethacin' },
            { id: '9.8', label: 'Ketoprofen' },
            { id: '9.9', label: 'Ketorolac' },
            { id: '9.10', label: 'Meloxicam' },
            { id: '9.11', label: 'Nabumetone' },
            { id: '9.12', label: 'Naproxen' },
            { id: '9.13', label: 'Oxaprozin' },
            { id: '9.14', label: 'Piroxicam' },
            { id: '9.15', label: 'Sulindac' },
        ],
    },
    {
        id: '10',
        label: 'Anti Psychotics',
        children: [
            { id: '10.1', label: 'Aripiprazole' },
            { id: '10.2', label: 'Asenapine' },
            { id: '10.3', label: 'Brexpiprazole' },
            { id: '10.4', label: 'Cariprazine' },
            { id: '10.5', label: 'Clozapine' },
            { id: '10.6', label: 'Iloperidone' },
            { id: '10.7', label: 'Loxapine' },
            { id: '10.8', label: 'Lurasidone' },
            { id: '10.9', label: 'Molindone' },
            { id: '10.10', label: 'Olanzapine' },
            { id: '10.11', label: 'Paliperidone' },
            { id: '10.12', label: 'Pimozide' },
            { id: '10.13', label: 'Quetiapine' },
            { id: '10.14', label: 'Risperidone' },
            { id: '10.15', label: 'Ziprasidone' },
        ],
    },
    {
        id: '11',
        label: 'Antidepressants',
        children: [
            { id: '11.1', label: 'Amitriptyline' },
            { id: '11.2', label: 'Bupropion' },
            { id: '11.3', label: 'Citalopram' },
            { id: '11.4', label: 'Desvenlafaxine' },
            { id: '11.5', label: 'Duloxetine' },
            { id: '11.6', label: 'Escitalopram' },
            { id: '11.7', label: 'Fluoxetine' },
            { id: '11.8', label: 'Imipramine' },
            { id: '11.9', label: 'Mirtazapine' },
            { id: '11.10', label: 'Paroxetine' },
            { id: '11.11', label: 'Sertraline' },
            { id: '11.12', label: 'Trazodone' },
            { id: '11.13', label: 'Venlafaxine' },
            { id: '11.14', label: 'Vilazodone' },
            { id: '11.15', label: 'Vortioxetine' },
        ],
    },
    {
        id: '12',
        label: 'Anxiolytics',
        children: [
            { id: '12.1', label: 'Alprazolam' },
            { id: '12.2', label: 'Buspirone' },
            { id: '12.3', label: 'Chlordiazepoxide' },
            { id: '12.4', label: 'Clonazepam' },
            { id: '12.5', label: 'Clorazepate' },
            { id: '12.6', label: 'Diazepam' },
            { id: '12.7', label: 'Gabapentin' },
            { id: '12.8', label: 'Hydroxyzine' },
            { id: '12.9', label: 'Lorazepam' },
            { id: '12.10', label: 'Oxazepam' },
            { id: '12.11', label: 'Oxcarbazepine' },
            { id: '12.12', label: 'Pregabalin' },
            { id: '12.13', label: 'Propranolol' },
            { id: '12.14', label: 'Temazepam' },
            { id: '12.15', label: 'Trazodone' },
        ],
    },
    {
        id: '13',
        label: 'Cannabinoids',
        children: [
            { id: '13.1', label: 'Cannabichromene' },
            { id: '13.2', label: 'Cannabidiol' },
            { id: '13.3', label: 'Cannabigerol' },
            { id: '13.4', label: 'Cannabis' },
            { id: '13.5', label: 'Delta-9-Tetrahydrocannabinol' },
            { id: '13.6', label: 'Tetrahydrocannabivarin' },
        ],
    },
    {
        id: '14',
        label: 'Contraception',
        children: [
            { id: '14.1', label: 'Chlormadinone Acetate' },
            { id: '14.2', label: 'Desogestrel' },
            { id: '14.3', label: 'Dienogest' },
            { id: '14.4', label: 'Drospirenone' },
            { id: '14.5', label: 'Ethinyl Estradiol' },
            { id: '14.6', label: 'Levonorgestrel' },
            { id: '14.7', label: 'Mestranol' },
            { id: '14.8', label: 'Nomegestrol Acetate' },
            { id: '14.9', label: 'Norethindrone' },
            { id: '14.10', label: 'Norgestimate' },
            { id: '14.11', label: 'Norgestrel' },
            { id: '14.12', label: 'Segesterone Acetate' },
            { id: '14.13', label: 'Ulipristal Acetate' },
        ],
    },
];

// Helper functions to generate random authors
const firstNames = [
    'James',
    'Mary',
    'John',
    'Patricia',
    'Robert',
    'Jennifer',
    'Michael',
    'Linda',
    'William',
    'Elizabeth',
    'David',
    'Barbara',
    'Richard',
    'Susan',
    'Joseph',
    'Jessica',
    'Thomas',
    'Sarah',
    'Charles',
    'Karen',
    'Christopher',
    'Nancy',
    'Daniel',
    'Lisa',
    'Matthew',
    'Margaret',
    'Anthony',
    'Betty',
    'Mark',
    'Sandra',
];

const lastNames = [
    'Smith',
    'Johnson',
    'Williams',
    'Brown',
    'Jones',
    'Garcia',
    'Miller',
    'Davis',
    'Rodriguez',
    'Martinez',
    'Hernandez',
    'Lopez',
    'Gonzalez',
    'Wilson',
    'Anderson',
    'Thomas',
    'Taylor',
    'Moore',
    'Jackson',
    'Martin',
    'Lee',
    'Perez',
    'Thompson',
    'White',
    'Harris',
    'Sanchez',
    'Clark',
    'Ramirez',
    'Lewis',
    'Robinson',
];

const generateRandomAuthor = (): string => {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const initial = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Random letter A-Z
    return `${lastName}, ${firstName[0]}. ${initial}.`;
};

const generateAuthors = (count: number = 3): string => {
    const authors = Array.from({ length: count }, () => generateRandomAuthor());
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
    return `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;
};

// Helper functions to generate random paper titles
const titlePrefixes = [
    'Neural correlates of',
    'Functional connectivity in',
    'Brain activity during',
    'The role of',
    'Cognitive mechanisms underlying',
    'Structural changes in',
    'Altered brain function in',
    'The neural basis of',
    'fMRI investigation of',
    'Effects of',
    'A meta-analysis of',
    'Resting-state connectivity in',
    'Task-related activation in',
    'Gray matter volume in',
    'White matter integrity in',
    'Network dysfunction in',
    'Neurocognitive effects of',
    'Brain regions involved in',
    'Differential activation of',
    'Abnormal activity in',
];

const titleTopics = [
    'emotional processing',
    'working memory',
    'reward anticipation',
    'decision making',
    'language comprehension',
    'visual attention',
    'motor control',
    'social cognition',
    'pain perception',
    'episodic memory',
    'executive function',
    'fear conditioning',
    'semantic processing',
    'cognitive control',
    'error monitoring',
    'response inhibition',
    'conflict resolution',
    'temporal processing',
    'spatial navigation',
    'face recognition',
];

const titleContexts = [
    'healthy adults',
    'patients with depression',
    'individuals with anxiety',
    'schizophrenia patients',
    'adolescents',
    'older adults',
    'chronic pain patients',
    'autism spectrum disorder',
    'ADHD patients',
    'substance users',
    'post-traumatic stress disorder',
    'bipolar disorder patients',
    "Alzheimer's disease",
    "Parkinson's disease patients",
    'traumatic brain injury',
    'multiple sclerosis patients',
    'stroke survivors',
    'obsessive-compulsive disorder',
    'eating disorder patients',
    'sleep-deprived individuals',
];

const titleSuffixes = [
    'using fMRI',
    'an event-related design',
    'a longitudinal study',
    'evidence from neuroimaging',
    'implications for treatment',
    'a cross-sectional study',
    'multivariate pattern analysis',
    'a randomized controlled trial',
    'preliminary findings',
    'insights from brain imaging',
];

const generatePaperTitle = (): string => {
    const useContext = Math.random() > 0.3;
    const useSuffix = Math.random() > 0.5;

    const prefix = titlePrefixes[Math.floor(Math.random() * titlePrefixes.length)];
    const topic = titleTopics[Math.floor(Math.random() * titleTopics.length)];
    const context = titleContexts[Math.floor(Math.random() * titleContexts.length)];
    const suffix = titleSuffixes[Math.floor(Math.random() * titleSuffixes.length)];

    let title = `${prefix} ${topic}`;
    if (useContext) {
        title += ` in ${context}`;
    }
    if (useSuffix) {
        title += `: ${suffix}`;
    }

    return title;
};

// Helper function to generate random year
const generateYear = (): number => {
    const currentYear = new Date().getFullYear();
    const startYear = 2000;
    return Math.floor(Math.random() * (currentYear - startYear + 1)) + startYear;
};

// Helper function to generate random publication/journal name
const journalNames = [
    'Nature Neuroscience',
    'Science',
    'Nature',
    'Neuron',
    'Brain',
    'NeuroImage',
    'Cerebral Cortex',
    'Journal of Neuroscience',
    'Proceedings of the National Academy of Sciences',
    'Brain Research',
    'Human Brain Mapping',
    'Cortex',
    'Neuropsychologia',
    'Biological Psychiatry',
    'American Journal of Psychiatry',
    'JAMA Psychiatry',
    'Molecular Psychiatry',
    'Journal of Cognitive Neuroscience',
    'Cognitive Brain Research',
    'Brain and Cognition',
    'Psychological Science',
    'Psychological Medicine',
    'Journal of Neurophysiology',
    'Frontiers in Human Neuroscience',
    'PLoS ONE',
    'Scientific Reports',
    'eLife',
    'Current Biology',
    'Trends in Cognitive Sciences',
    'Annual Review of Neuroscience',
];

const generatePublication = (): string => {
    return journalNames[Math.floor(Math.random() * journalNames.length)];
};

// Helper function to generate lorem ipsum text
const loremWords = [
    'lorem',
    'ipsum',
    'dolor',
    'sit',
    'amet',
    'consectetur',
    'adipiscing',
    'elit',
    'sed',
    'do',
    'eiusmod',
    'tempor',
    'incididunt',
    'ut',
    'labore',
    'et',
    'dolore',
    'magna',
    'aliqua',
    'enim',
    'ad',
    'minim',
    'veniam',
    'quis',
    'nostrud',
    'exercitation',
    'ullamco',
    'laboris',
    'nisi',
    'aliquip',
    'ex',
    'ea',
    'commodo',
    'consequat',
    'duis',
    'aute',
    'irure',
    'in',
    'reprehenderit',
    'voluptate',
    'velit',
    'esse',
    'cillum',
    'fugiat',
    'nulla',
    'pariatur',
    'excepteur',
    'sint',
    'occaecat',
    'cupidatat',
    'non',
    'proident',
    'sunt',
    'culpa',
    'qui',
    'officia',
    'deserunt',
    'mollit',
    'anim',
    'id',
    'est',
    'laborum',
];

const generateLoremIpsum = (sentenceCount: number = 3): string => {
    const sentences: string[] = [];

    for (let i = 0; i < sentenceCount; i++) {
        const wordCount = Math.floor(Math.random() * 10) + 8; // 8-17 words per sentence
        const words: string[] = [];

        for (let j = 0; j < wordCount; j++) {
            const word = loremWords[Math.floor(Math.random() * loremWords.length)];
            if (j === 0) {
                words.push(word.charAt(0).toUpperCase() + word.slice(1));
            } else {
                words.push(word);
            }
        }

        sentences.push(words.join(' ') + '.');
    }

    return sentences.join(' ');
};

const studies: StudyReturn[] = new Array(15).fill(0).map((_, index) => ({
    id: `study-${index + 1}`,
    name: generatePaperTitle(),
    description: generateLoremIpsum(Math.floor(Math.random() * 3) + 2), // 2-4 sentences
    publication: generatePublication(),
    year: generateYear(),
    authors: generateAuthors(Math.floor(Math.random() * 5) + 1),
    pmid: `1234567890${index + 1}`,
    doi: `10.1234567890${index + 1}`,
    user: `user-${index + 1}`,
    username: `user-${index + 1}`,
    source: `source-${index + 1}`,
    source_id: `source-${index + 1}`,
    source_updated_at: `2021-01-01`,
    created_at: `2021-01-01`,
    updated_at: `2021-01-01`,
    public: true,
    has_coordinates: true,
    has_images: true,
    base_study: `base-study-${index + 1}`,
    pmcid: `1234567890${index + 1}`,
    studysets: [],
    analyses: [],
}));

function NewStudySearchPage() {
    return (
        <Box sx={{ display: 'flex' }}>
            <Box sx={{ width: '250px', minWidth: '250px', padding: '0 0.5rem' }}>
                <Box sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ textTransform: 'uppercase' }} color="gray">
                        Publication Year
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Slider
                            sx={{ width: '85%', textAlign: 'center' }}
                            size="small"
                            value={[0, 100]}
                            marks={[
                                { value: 0, label: '2011' },
                                { value: 100, label: '2025' },
                            ]}
                        />
                    </Box>
                </Box>
                <Box sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ textTransform: 'uppercase' }} color="gray">
                        Number of Participants
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Slider
                            sx={{ width: '85%', textAlign: 'center' }}
                            size="small"
                            value={[0, 100]}
                            marks={[
                                { value: 0, label: '0' },
                                { value: 100, label: '200+' },
                            ]}
                        />
                    </Box>
                </Box>
                <Box sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ textTransform: 'uppercase' }} color="gray">
                        Datatype
                    </Typography>
                    <Box sx={{ display: 'flex', px: 1 }}>
                        <FormControl>
                            <RadioGroup>
                                <FormControlLabel
                                    value="coordinate"
                                    control={<Radio size="small" />}
                                    label="Coordinate"
                                    slotProps={{
                                        typography: { sx: { fontSize: '12px' } },
                                    }}
                                />
                                <FormControlLabel
                                    value="image"
                                    control={<Radio size="small" />}
                                    label="Image"
                                    slotProps={{
                                        typography: { sx: { fontSize: '12px' } },
                                    }}
                                />
                                <FormControlLabel
                                    value="all"
                                    control={<Radio size="small" />}
                                    label="All"
                                    slotProps={{
                                        typography: { sx: { fontSize: '12px' } },
                                    }}
                                />
                            </RadioGroup>
                        </FormControl>
                    </Box>
                </Box>
                <Box sx={{ backgroundColor: '#fafafa', paddingBottom: '1rem' }}>
                    <Box sx={{ mb: 1, backgroundColor: 'white' }}>
                        <OutlinedInput size="small" placeholder="Filter..." sx={{ fontSize: '12px' }} fullWidth />
                    </Box>
                    <Box sx={{ px: 1 }}>
                        <Typography variant="subtitle1" sx={{ textTransform: 'uppercase' }} color="gray">
                            Brain Regions
                        </Typography>
                        <TreeView items={brainRegionsItems} onSelectedItemsChange={() => {}} />
                    </Box>
                    <Box sx={{ px: 1 }}>
                        <Typography variant="subtitle1" sx={{ textTransform: 'uppercase' }} color="gray">
                            Disorders and Conditions
                        </Typography>
                        <TreeView items={disordersAndConditionsItems} onSelectedItemsChange={() => {}} />
                    </Box>
                    <Box sx={{ px: 1 }}>
                        <Typography variant="subtitle1" sx={{ textTransform: 'uppercase' }} color="gray">
                            Drugs and Medications
                        </Typography>
                        <TreeView items={drugsAndMedicationsItems} onSelectedItemsChange={() => {}} />
                    </Box>
                    <Box sx={{ px: 1 }}>
                        <Button size="small" fullWidth>
                            Add Fields
                        </Button>
                    </Box>
                </Box>
            </Box>
            <Box sx={{ flexGrow: 1, height: '100%', padding: '0rem 1rem' }}>
                <Box sx={{ display: 'flex' }}>
                    <Paper
                        variant="outlined"
                        sx={{ flexGrow: 1, borderTopRightRadius: '0px', borderBottomRightRadius: '0px' }}
                    >
                        <InputBase
                            sx={{
                                padding: '4px 1rem',
                                width: '100%',
                            }}
                            placeholder="Search for studies..."
                            endAdornment={
                                <IconButton size="small">
                                    <CloseIcon />
                                </IconButton>
                            }
                        />
                    </Paper>
                    <Button
                        disableElevation
                        type="submit"
                        sx={{
                            borderTopLeftRadius: '0px',
                            borderBottomLeftRadius: '0px',
                            width: '150px',
                        }}
                        variant="contained"
                        startIcon={<SearchIcon />}
                    >
                        Search
                    </Button>
                </Box>
                <Box sx={{ pt: 2, pb: 1, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                    <Box
                        sx={{
                            backgroundColor: 'success.main',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 0px 2px 0px',
                            borderRadius: '20px',
                        }}
                    >
                        <Icon sx={{ mx: 0.5 }}>
                            <Check fontSize="small" sx={{ color: 'white' }} />
                        </Icon>
                        <Breadcrumbs separator=">" sx={{ color: 'white' }}>
                            <Typography sx={{ fontSize: '12px' }}>Brain Regions</Typography>
                            <Link
                                component={Typography}
                                sx={{
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    color: 'white',
                                    textDecoration: 'underline',
                                }}
                            >
                                Brain Networks
                            </Link>
                            <Typography sx={{ fontSize: '12px' }}>Central Executive network</Typography>
                        </Breadcrumbs>
                        <IconButton size="small" sx={{ ml: 1 }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <Box
                        sx={{
                            backgroundColor: 'error.main',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 0px 2px 0px',
                            borderRadius: '20px',
                        }}
                    >
                        <Icon sx={{ mx: 0.5 }}>
                            <Remove fontSize="small" sx={{ color: 'white' }} />
                        </Icon>
                        <Breadcrumbs separator=">" sx={{ color: 'white' }}>
                            <Typography sx={{ fontSize: '12px' }}>Drugs and Medications</Typography>
                            <Link
                                component={Typography}
                                sx={{
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    color: 'white',
                                    textDecoration: 'underline',
                                }}
                            >
                                Anesthetics
                            </Link>
                            <Typography sx={{ fontSize: '12px' }}>Enflurane</Typography>
                        </Breadcrumbs>
                        <IconButton size="small" sx={{ ml: 1 }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    <Box
                        sx={{
                            backgroundColor: 'success.main',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 0px 2px 0px',
                            borderRadius: '20px',
                        }}
                    >
                        <Icon sx={{ mx: 0.5 }}>
                            <Check fontSize="small" sx={{ color: 'white' }} />
                        </Icon>
                        <Breadcrumbs separator=">" sx={{ color: 'white' }}>
                            <Typography sx={{ fontSize: '12px' }}>Disorders and Conditions</Typography>
                            <Typography sx={{ fontSize: '12px' }}>Medical</Typography>
                        </Breadcrumbs>
                        <IconButton size="small" sx={{ ml: 1 }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>
                <Box>
                    {studies.map((study) => (
                        <Box key={study.id} sx={{ py: '0.5rem' }}>
                            <Link
                                component={Typography}
                                underline="hover"
                                sx={{ cursor: 'pointer' }}
                                variant="h6"
                                color="primary"
                            >
                                ({study.year}). {study.name}
                            </Link>
                            <Typography variant="body2">{study.authors}</Typography>
                            <Typography variant="body2">{study.publication}</Typography>
                            <Typography variant="body2" color="gray">
                                {study.description}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
}

// {/* <Paper key={study.id} sx={{ margin: '1rem 0', padding: '0.5rem' }}>
//     <Typography variant="subtitle1">{study.name}</Typography>
//     <Typography variant="body2">{study.description}</Typography>
//     <Typography variant="body2">{study.publication}</Typography>
//     <Typography variant="body2">{study.year}</Typography>
//     <Typography variant="body2">{study.authors}</Typography>
// </Paper> */}
export default NewStudySearchPage;
