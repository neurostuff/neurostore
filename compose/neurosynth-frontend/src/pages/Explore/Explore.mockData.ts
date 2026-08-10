export type OnvocTreeNode = {
    id: string;
    label: string;
    children?: OnvocTreeNode[];
};

export type MockBrainMap = {
    id: string;
    title: string;
    abstract: string;
    year: number;
    modality: string;
    mapType: string;
    analysisType: 'CBMA' | 'IBMA';
    onvocTerms: string[];
    source: 'user' | 'legacy';
};

export const MOCK_ONVOC_TREE: OnvocTreeNode[] = [
    {
        id: 'cognition',
        label: 'Cognition',
        children: [
            {
                id: 'cognition-memory',
                label: 'Memory',
                children: [
                    { id: 'term-working-memory', label: 'working memory' },
                    { id: 'term-episodic-memory', label: 'episodic memory' },
                    { id: 'term-semantic-memory', label: 'semantic memory' },
                    { id: 'term-autobiographical-memory', label: 'autobiographical memory' },
                    { id: 'term-recognition-memory', label: 'recognition memory' },
                ],
            },
            {
                id: 'cognition-language',
                label: 'Language',
                children: [
                    { id: 'term-semantic-processing', label: 'semantic processing' },
                    { id: 'term-speech-production', label: 'speech production' },
                    { id: 'term-speech-comprehension', label: 'speech comprehension' },
                    { id: 'term-reading', label: 'reading' },
                    { id: 'term-naming', label: 'naming' },
                ],
            },
            {
                id: 'cognition-attention',
                label: 'Attention',
                children: [
                    { id: 'term-selective-attention', label: 'selective attention' },
                    { id: 'term-sustained-attention', label: 'sustained attention' },
                    { id: 'term-divided-attention', label: 'divided attention' },
                    { id: 'term-spatial-attention', label: 'spatial attention' },
                ],
            },
            {
                id: 'cognition-executive',
                label: 'Executive function',
                children: [
                    { id: 'term-cognitive-control', label: 'cognitive control' },
                    { id: 'term-task-switching', label: 'task switching' },
                    { id: 'term-stroop', label: 'stroop' },
                    { id: 'term-n-back', label: 'n-back' },
                    { id: 'term-decision-making', label: 'decision making' },
                ],
            },
        ],
    },
    {
        id: 'emotion',
        label: 'Emotion',
        children: [
            {
                id: 'emotion-affect',
                label: 'Affect',
                children: [
                    { id: 'term-fear', label: 'fear' },
                    { id: 'term-reward', label: 'reward' },
                    { id: 'term-pain', label: 'pain' },
                    { id: 'term-anxiety', label: 'anxiety' },
                    { id: 'term-happiness', label: 'happiness' },
                    { id: 'term-anger', label: 'anger' },
                    { id: 'term-disgust', label: 'disgust' },
                ],
            },
            {
                id: 'emotion-social',
                label: 'Social',
                children: [
                    { id: 'term-theory-of-mind', label: 'theory of mind' },
                    { id: 'term-face-recognition', label: 'face recognition' },
                    { id: 'term-empathy', label: 'empathy' },
                    { id: 'term-social-cognition', label: 'social cognition' },
                ],
            },
        ],
    },
    {
        id: 'perception',
        label: 'Perception',
        children: [
            {
                id: 'perception-vision',
                label: 'Vision',
                children: [
                    { id: 'term-visual-motion', label: 'visual motion' },
                    { id: 'term-object-recognition', label: 'object recognition' },
                    { id: 'term-face-perception', label: 'face perception' },
                    { id: 'term-visual-attention', label: 'visual attention' },
                ],
            },
            {
                id: 'perception-audition',
                label: 'Audition',
                children: [
                    { id: 'term-auditory-perception', label: 'auditory perception' },
                    { id: 'term-music', label: 'music' },
                    { id: 'term-voice', label: 'voice' },
                ],
            },
            {
                id: 'perception-somatosensory',
                label: 'Somatosensory',
                children: [
                    { id: 'term-touch', label: 'touch' },
                    { id: 'term-proprioception', label: 'proprioception' },
                ],
            },
        ],
    },
    {
        id: 'action',
        label: 'Action',
        children: [
            {
                id: 'action-motor',
                label: 'Motor',
                children: [
                    { id: 'term-motor-execution', label: 'motor execution' },
                    { id: 'term-motor-imagery', label: 'motor imagery' },
                    { id: 'term-inhibition', label: 'response inhibition' },
                    { id: 'term-eye-movements', label: 'eye movements' },
                    { id: 'term-grasping', label: 'grasping' },
                ],
            },
        ],
    },
];

const collectOnvocLeafLabels = (nodes: OnvocTreeNode[]): string[] => {
    const labels: string[] = [];
    const walk = (node: OnvocTreeNode) => {
        if (!node.children?.length) {
            labels.push(node.label);
            return;
        }
        node.children.forEach(walk);
    };
    nodes.forEach(walk);
    return labels;
};

/** Flat leaf terms from the mock ONVOC tree, for autocomplete UIs. */
export const MOCK_ONVOC_TERMS: string[] = Array.from(new Set(collectOnvocLeafLabels(MOCK_ONVOC_TREE))).sort((left, right) =>
    left.localeCompare(right)
);
export const MOCK_BRAIN_MAPS: MockBrainMap[] = [
    {
        id: 'map-1',
        title: 'Working memory load in dorsolateral prefrontal cortex',
        abstract:
            'Meta-analytic map associating parametric increases in working memory load with bilateral DLPFC and superior parietal activation across n-back paradigms.',
        year: 2021,
        modality: 'fMRI',
        mapType: 'activation',
        analysisType: 'CBMA',
        onvocTerms: ['working memory', 'selective attention', 'n-back', 'cognitive control', 'task switching'],
        source: 'legacy',
    },
    {
        id: 'map-2',
        title: 'Episodic encoding in the medial temporal lobe',
        abstract:
            'Coordinate-based synthesis of episodic memory encoding contrasts highlighting hippocampus and parahippocampal cortex.',
        year: 2019,
        modality: 'fMRI',
        mapType: 'activation',
        analysisType: 'IBMA',
        onvocTerms: ['episodic memory', 'recognition memory', 'autobiographical memory'],
        source: 'user',
    },
    {
        id: 'map-3',
        title: 'Semantic processing across temporal and prefrontal cortex',
        abstract:
            'Association map for semantic judgment and category fluency tasks, with peaks in left inferior frontal gyrus and middle temporal gyrus.',
        year: 2020,
        modality: 'fMRI',
        mapType: 'association',
        analysisType: 'CBMA',
        onvocTerms: ['semantic processing', 'semantic memory', 'reading', 'naming'],
        source: 'legacy',
    },
    {
        id: 'map-4',
        title: 'Speech production and articulation network',
        abstract:
            'Activation likelihood estimate for overt and covert speech production, including ventral motor cortex and supplementary motor area.',
        year: 2018,
        modality: 'fMRI',
        mapType: 'activation',
        analysisType: 'IBMA',
        onvocTerms: ['speech production', 'motor execution', 'speech comprehension'],
        source: 'user',
    },
    {
        id: 'map-5',
        title: 'Fear conditioning in the amygdala',
        abstract:
            'Consistent amygdala and insula responses during fear acquisition and threat anticipation across classical conditioning studies.',
        year: 2022,
        modality: 'fMRI',
        mapType: 'activation',
        analysisType: 'CBMA',
        onvocTerms: ['fear', 'anxiety', 'emotion'],
        source: 'legacy',
    },
    {
        id: 'map-6',
        title: 'Reward anticipation in ventral striatum',
        abstract:
            'Monetary incentive delay and similar reward paradigms converging on nucleus accumbens and ventromedial prefrontal cortex.',
        year: 2021,
        modality: 'fMRI',
        mapType: 'activation',
        analysisType: 'IBMA',
        onvocTerms: ['reward', 'decision making', 'happiness'],
        source: 'user',
    },
    {
        id: 'map-7',
        title: 'Pain processing in the dorsal anterior cingulate',
        abstract:
            'Noxious thermal and mechanical stimulation maps emphasizing dACC, anterior insula, and secondary somatosensory cortex.',
        year: 2017,
        modality: 'fMRI',
        mapType: 'activation',
        analysisType: 'CBMA',
        onvocTerms: ['pain', 'touch', 'proprioception'],
        source: 'legacy',
    },
    {
        id: 'map-8',
        title: 'Theory of mind in temporoparietal junction',
        abstract:
            'False-belief and mentalizing contrasts with reliable peaks in bilateral TPJ, medial prefrontal cortex, and precuneus.',
        year: 2020,
        modality: 'fMRI',
        mapType: 'association',
        analysisType: 'IBMA',
        onvocTerms: ['theory of mind', 'face recognition', 'empathy', 'social cognition'],
        source: 'user',
    },
    {
        id: 'map-9',
        title: 'Visual motion selectivity in MT+',
        abstract:
            'Coherent motion versus static displays highlighting human motion-sensitive cortex (MT/V5) and adjacent parietal areas.',
        year: 2016,
        modality: 'fMRI',
        mapType: 'activation',
        analysisType: 'CBMA',
        onvocTerms: ['visual motion', 'visual attention', 'object recognition'],
        source: 'legacy',
    },
    {
        id: 'map-10',
        title: 'Object recognition in ventral visual stream',
        abstract:
            'Object versus scrambled-object contrasts spanning lateral occipital complex and posterior fusiform gyrus.',
        year: 2019,
        modality: 'fMRI',
        mapType: 'activation',
        analysisType: 'IBMA',
        onvocTerms: ['object recognition', 'face perception', 'visual attention'],
        source: 'user',
    },
    {
        id: 'map-11',
        title: 'Motor imagery of hand movements',
        abstract:
            'Imagined finger sequencing without overt movement, engaging premotor cortex and superior parietal lobule.',
        year: 2023,
        modality: 'fMRI',
        mapType: 'activation',
        analysisType: 'CBMA',
        onvocTerms: ['motor imagery', 'motor execution', 'grasping', 'eye movements'],
        source: 'legacy',
    },
    {
        id: 'map-12',
        title: 'Response inhibition in the right inferior frontal gyrus',
        abstract:
            'Stop-signal and go/no-go meta-map centered on right IFG, pre-SMA, and subthalamic regions.',
        year: 2022,
        modality: 'fMRI',
        mapType: 'activation',
        analysisType: 'IBMA',
        onvocTerms: ['response inhibition', 'sustained attention', 'cognitive control', 'stroop'],
        source: 'user',
    },
];

export const getOnvocLabelById = (nodes: OnvocTreeNode[], targetId: string): string | undefined => {
    for (const node of nodes) {
        if (node.id === targetId) {
            return node.label;
        }
        if (node.children) {
            const childLabel = getOnvocLabelById(node.children, targetId);
            if (childLabel) {
                return childLabel;
            }
        }
    }
    return undefined;
};
