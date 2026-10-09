import { DropResult, ResponderProvided } from '@hello-pangea/dnd';
import { EAnalysisType, IProvenance } from 'hooks/projects/Project.types';
import { ProjectReturnTypeEnum } from 'neurosynth-compose-typescript-sdk';
import { ICurationColumn, ICurationMetadata, ICurationStubStudy, ITag } from 'pages/Curation/Curation.types';
import { EExtractionStatus, IStudyExtractionStatus } from 'pages/Extraction/Extraction.types';
import {
    addNewStubsHelper,
    addOrUpdateStudyListStatusHelper,
    addTagToStubHelper,
    createNewExclusionHelper,
    demoteStubHelper,
    generateNewProjectData,
    getExclusionsHelper,
    getNextUntitledProjectName,
    handleDragEndHelper,
    initCurationHelper,
    promoteAllUncategorizedHelper,
    promoteStubHelper,
    removeTagFromStubHelper,
    replaceStudyListStatusIdHelper,
    setExclusionForStubHelper,
    setGivenStudyStatusesAsCompleteHelper,
    updateExclusionTagHelper,
    updateStubFieldHelper,
} from 'stores/projects/ProjectStore.helpers';
import {
    defaultExclusionTags,
    defaultIdentificationSources,
    defaultInfoTags,
    ENeurosynthTagIds,
    PRISMAEligibilityExclusionTags,
} from 'stores/projects/ProjectStore.consts';

const CBMA = EAnalysisType.CBMA;
const IBMA = EAnalysisType.IBMA;

const makeStub = (id: string, overrides: Partial<ICurationStubStudy> = {}) =>
    ({ id, exclusionTag: null, tags: [], ...overrides }) as ICurationStubStudy;

const makeColumn = (id: string, stubs: ICurationStubStudy[]): ICurationColumn => ({
    id,
    name: id,
    stubStudies: stubs,
});

const stubIds = (column: ICurationColumn) => column.stubStudies.map((stub) => stub.id);

const tag = (id: string, isExclusionTag = false): ITag => ({ id, label: id, isExclusionTag, isAssignable: true });

describe('getNextUntitledProjectName', () => {
    it('returns "Untitled {type}" when no existing names match for that type', () => {
        expect(getNextUntitledProjectName(CBMA, [])).toBe('Untitled CBMA');
        expect(getNextUntitledProjectName(CBMA, ['My Project', 'Other'])).toBe('Untitled CBMA');
        expect(getNextUntitledProjectName(IBMA, [])).toBe('Untitled IBMA');
        expect(getNextUntitledProjectName(IBMA, ['Untitled CBMA', 'Untitled CBMA 2'])).toBe('Untitled IBMA');
    });

    it('returns "Untitled {type} 2" when only "Untitled {type}" exists', () => {
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA'])).toBe('Untitled CBMA 2');
        expect(getNextUntitledProjectName(IBMA, ['Untitled IBMA'])).toBe('Untitled IBMA 2');
    });

    it('returns the next number after the max existing Untitled {type} N', () => {
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA', 'Untitled CBMA 2'])).toBe('Untitled CBMA 3');
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA 2', 'Untitled CBMA 3'])).toBe('Untitled CBMA 4');
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA', 'Untitled CBMA 2', 'Untitled CBMA 3'])).toBe(
            'Untitled CBMA 4'
        );
    });

    it('ignores non-matching names when computing the next number', () => {
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA', 'My Project', 'Untitled CBMA 2'])).toBe(
            'Untitled CBMA 3'
        );
        expect(getNextUntitledProjectName(CBMA, ['Other', 'Untitled CBMA 5'])).toBe('Untitled CBMA 6');
        expect(getNextUntitledProjectName(CBMA, ['Untitled IBMA', 'Untitled IBMA 3'])).toBe('Untitled CBMA');
    });

    it('handles gaps in numbering (uses max, not count)', () => {
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA', 'Untitled CBMA 3'])).toBe('Untitled CBMA 4');
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA 10'])).toBe('Untitled CBMA 11');
    });

    it('trims whitespace from project names before matching', () => {
        expect(getNextUntitledProjectName(CBMA, ['  Untitled CBMA  '])).toBe('Untitled CBMA 2');
        expect(getNextUntitledProjectName(CBMA, ['  Untitled CBMA 2  '])).toBe('Untitled CBMA 3');
    });

    it('handles null or undefined in the array by treating as non-matching', () => {
        expect(getNextUntitledProjectName(CBMA, [null as unknown as string, 'Untitled CBMA'])).toBe('Untitled CBMA 2');
        expect(getNextUntitledProjectName(CBMA, [undefined as unknown as string])).toBe('Untitled CBMA');
    });

    it('counts CBMA and IBMA names separately', () => {
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA', 'Untitled IBMA', 'Untitled IBMA 2'])).toBe(
            'Untitled CBMA 2'
        );
        expect(getNextUntitledProjectName(IBMA, ['Untitled CBMA', 'Untitled CBMA 2', 'Untitled IBMA'])).toBe(
            'Untitled IBMA 2'
        );
    });
});

describe('updateExclusionTagHelper', () => {
    const wrongSpecies: ITag = {
        id: 'wrong-species',
        label: 'Wrong species',
        isExclusionTag: true,
        isAssignable: true,
    };
    const noFmri: ITag = { id: 'no-fmri', label: 'No fMRI', isExclusionTag: true, isAssignable: true };

    const stub = (id: string, exclusionTag: string | null) => makeStub(id, { exclusionTag });

    const columns = [
        { id: 'col-1', name: 'Identification', stubStudies: [stub('rat', 'wrong-species'), stub('kept', null)] },
        { id: 'col-2', name: 'Screening', stubStudies: [stub('mouse', 'wrong-species'), stub('eeg', 'no-fmri')] },
        { id: 'col-3', name: 'Eligibility', stubStudies: [stub('monkey', 'wrong-species')] },
    ];

    const emptyPhase = { exclusionTags: [] as ITag[] };

    const buildProvenance = (isPrisma: boolean) =>
        ({
            curationMetadata: {
                columns,
                infoTags: [],
                identificationSources: [],
                imports: [],
                exclusionTags: isPrisma ? [] : [wrongSpecies, noFmri],
                prismaConfig: {
                    isPrisma,
                    identification: emptyPhase,
                    screening: isPrisma ? { exclusionTags: [wrongSpecies, noFmri] } : emptyPhase,
                    eligibility: emptyPhase,
                },
            },
        }) as unknown as IProvenance;

    // mirrors useProjectExclusionTag: a study shows the label of the tag its exclusionTag id points to
    const labelsByStudy = (provenance: IProvenance) =>
        Object.fromEntries(
            provenance.curationMetadata.columns
                .flatMap((column) => column.stubStudies)
                .filter((study) => study.exclusionTag)
                .map((study) => [
                    study.id,
                    getExclusionsHelper(provenance).find((tag) => tag.id === study.exclusionTag)?.label,
                ])
        );

    it.each([
        ['non-PRISMA', false],
        ['PRISMA', true],
    ])('gives every %s study with the exclusion the new label', (_workflow, isPrisma) => {
        const updated = updateExclusionTagHelper(buildProvenance(isPrisma), 'wrong-species', 'Non-human study');

        expect(labelsByStudy(updated)).toEqual({
            rat: 'Non-human study',
            mouse: 'Non-human study',
            monkey: 'Non-human study',
            eeg: 'No fMRI',
        });
    });

    it.each([
        ['non-PRISMA', false],
        ['PRISMA', true],
    ])('keeps the exclusion id so %s studies still point to it', (_workflow, isPrisma) => {
        const updated = updateExclusionTagHelper(buildProvenance(isPrisma), 'wrong-species', 'Non-human study');

        expect(getExclusionsHelper(updated)).toContainEqual({ ...wrongSpecies, label: 'Non-human study' });
        expect(updated.curationMetadata.columns).toBe(columns);
    });

    it.each([
        ['non-PRISMA', false],
        ['PRISMA', true],
    ])('leaves a %s project unchanged when the exclusion does not exist', (_workflow, isPrisma) => {
        const provenance = buildProvenance(isPrisma);

        expect(updateExclusionTagHelper(provenance, 'missing', 'Non-human study')).toBe(provenance);
    });

    it('only renames the tag in the PRISMA phase that has it', () => {
        const provenance = buildProvenance(true);
        provenance.curationMetadata.prismaConfig.eligibility = { exclusionTags: [tag('late-exclusion', true)] };

        const updated = updateExclusionTagHelper(provenance, 'late-exclusion', 'Renamed');

        expect(updated.curationMetadata.prismaConfig.eligibility.exclusionTags).toEqual([
            { ...tag('late-exclusion', true), label: 'Renamed' },
        ]);
        expect(updated.curationMetadata.prismaConfig.screening).toBe(
            provenance.curationMetadata.prismaConfig.screening
        );
        expect(updated.curationMetadata.prismaConfig.identification).toBe(
            provenance.curationMetadata.prismaConfig.identification
        );
    });
});

describe('getExclusionsHelper', () => {
    it('returns the project exclusions for a non-PRISMA project', () => {
        const exclusionTags = [tag('a', true)];
        const provenance = {
            curationMetadata: { exclusionTags, prismaConfig: { isPrisma: false } },
        } as unknown as IProvenance;

        expect(getExclusionsHelper(provenance)).toBe(exclusionTags);
    });

    it('returns the identification, screening and eligibility exclusions in order for a PRISMA project', () => {
        const provenance = {
            curationMetadata: {
                exclusionTags: [tag('ignored', true)],
                prismaConfig: {
                    isPrisma: true,
                    identification: { exclusionTags: [tag('identification', true)] },
                    screening: { exclusionTags: [tag('screening', true)] },
                    eligibility: { exclusionTags: [tag('eligibility', true)] },
                },
            },
        } as unknown as IProvenance;

        expect(getExclusionsHelper(provenance).map((exclusion) => exclusion.id)).toEqual([
            'identification',
            'screening',
            'eligibility',
        ]);
    });
});

describe('handleDragEndHelper', () => {
    const provided = {} as ResponderProvided;
    const drop = (source: [string, number], destination?: [string, number]) =>
        ({
            source: { droppableId: source[0], index: source[1] },
            destination: destination && { droppableId: destination[0], index: destination[1] },
        }) as DropResult;

    const buildState = () => [
        makeColumn('col-1', [makeStub('a'), makeStub('b'), makeStub('c')]),
        makeColumn('col-2', [makeStub('d')]),
    ];

    it('returns the same state when dropped outside a column', () => {
        const state = buildState();

        expect(handleDragEndHelper(state, drop(['col-1', 0]), provided)).toBe(state);
    });

    it('returns the same state when dropped where it started', () => {
        const state = buildState();

        expect(handleDragEndHelper(state, drop(['col-1', 1], ['col-1', 1]), provided)).toBe(state);
    });

    it('reorders a study within the same column', () => {
        const state = buildState();

        const updated = handleDragEndHelper(state, drop(['col-1', 0], ['col-1', 2]), provided);

        expect(stubIds(updated[0])).toEqual(['b', 'c', 'a']);
        expect(updated[1]).toBe(state[1]);
        expect(stubIds(state[0])).toEqual(['a', 'b', 'c']);
    });

    it('moves a study to a position in another column', () => {
        const state = buildState();

        const updated = handleDragEndHelper(state, drop(['col-1', 1], ['col-2', 1]), provided);

        expect(stubIds(updated[0])).toEqual(['a', 'c']);
        expect(stubIds(updated[1])).toEqual(['d', 'b']);
        expect(stubIds(state[0])).toEqual(['a', 'b', 'c']);
        expect(stubIds(state[1])).toEqual(['d']);
    });

    it('returns the same state when the column is not found', () => {
        const state = buildState();

        expect(handleDragEndHelper(state, drop(['missing', 0], ['missing', 1]), provided)).toBe(state);
        expect(handleDragEndHelper(state, drop(['col-1', 0], ['missing', 0]), provided)).toBe(state);
        expect(handleDragEndHelper(state, drop(['missing', 0], ['col-2', 0]), provided)).toBe(state);
    });
});

describe('initCurationHelper', () => {
    it('creates an empty column with a unique id for each column name', () => {
        const curation = initCurationHelper(['Identification', 'Included'], false);

        expect(curation.columns.map((column) => column.name)).toEqual(['Identification', 'Included']);
        expect(curation.columns.every((column) => column.stubStudies.length === 0)).toBe(true);
        expect(new Set(curation.columns.map((column) => column.id)).size).toBe(2);
    });

    it('uses the default exclusions, info tags and sources with empty PRISMA phases for a non-PRISMA project', () => {
        const curation = initCurationHelper(['Identification', 'Included'], false);

        expect(curation).toMatchObject({
            prismaConfig: {
                isPrisma: false,
                identification: { exclusionTags: [] },
                screening: { exclusionTags: [] },
                eligibility: { exclusionTags: [] },
            },
            exclusionTags: Object.values(defaultExclusionTags),
            infoTags: Object.values(defaultInfoTags),
            identificationSources: Object.values(defaultIdentificationSources),
            imports: [],
        });
    });

    it('copies the defaults so editing a project does not change them', () => {
        const curation = initCurationHelper(['Identification'], false);

        expect(curation.exclusionTags[0]).not.toBe(defaultExclusionTags.exclusion);
        expect(curation.infoTags[0]).not.toBe(defaultInfoTags.untagged);
        expect(curation.identificationSources[0]).not.toBe(defaultIdentificationSources.neurostore);
    });

    it('sets the default exclusions for each PRISMA phase', () => {
        const curation = initCurationHelper(['Identification', 'Screening', 'Eligibility', 'Included'], true);

        expect(curation.prismaConfig.isPrisma).toBe(true);
        expect(curation.prismaConfig.identification.exclusionTags).toEqual([defaultExclusionTags.duplicate]);
        expect(curation.prismaConfig.screening.exclusionTags).toEqual([
            {
                id: ENeurosynthTagIds.IRRELEVANT_EXCLUSION_ID,
                label: 'Irrelevant',
                isExclusionTag: true,
                isAssignable: true,
            },
        ]);
        expect(curation.prismaConfig.eligibility.exclusionTags).toEqual(Object.values(PRISMAEligibilityExclusionTags));
    });
});

describe('addNewStubsHelper', () => {
    it('adds the new studies to the top of the first column', () => {
        const state = [makeColumn('col-1', [makeStub('existing')]), makeColumn('col-2', [makeStub('other')])];

        const updated = addNewStubsHelper(state, [makeStub('new-1'), makeStub('new-2')]);

        expect(stubIds(updated[0])).toEqual(['new-1', 'new-2', 'existing']);
        expect(updated[1]).toBe(state[1]);
        expect(stubIds(state[0])).toEqual(['existing']);
    });
});

describe('updateStubFieldHelper', () => {
    it('updates the field on the matching study only', () => {
        const state = [makeColumn('col-1', [makeStub('a', { title: 'Old' }), makeStub('b', { title: 'Other' })])];

        const updated = updateStubFieldHelper(state, 0, 'a', 'title', 'New');

        expect(updated[0].stubStudies.map((stub) => stub.title)).toEqual(['New', 'Other']);
        expect(state[0].stubStudies[0].title).toBe('Old');
    });

    it('returns the same state when the study is not in the column', () => {
        const state = [makeColumn('col-1', [makeStub('a')])];

        expect(updateStubFieldHelper(state, 0, 'missing', 'title', 'New')).toBe(state);
    });
});

describe('promoteStubHelper', () => {
    const buildState = () => [
        makeColumn('col-1', [makeStub('a'), makeStub('b')]),
        makeColumn('col-2', [makeStub('c')]),
    ];

    it('moves the study to the top of the next column', () => {
        const state = buildState();

        const updated = promoteStubHelper(state, 0, 'b');

        expect(stubIds(updated[0])).toEqual(['a']);
        expect(stubIds(updated[1])).toEqual(['b', 'c']);
        expect(stubIds(state[0])).toEqual(['a', 'b']);
    });

    it('returns the same state from the last column', () => {
        const state = buildState();

        expect(promoteStubHelper(state, 1, 'c')).toBe(state);
    });

    it('returns the same state when the study is not in the column', () => {
        const state = buildState();

        expect(promoteStubHelper(state, 0, 'missing')).toBe(state);
    });
});

describe('demoteStubHelper', () => {
    const buildState = () => [
        makeColumn('col-1', [makeStub('a')]),
        makeColumn('col-2', [makeStub('b'), makeStub('c')]),
    ];

    it('moves the study to the top of the previous column', () => {
        const state = buildState();

        const updated = demoteStubHelper(state, 1, 'c');

        expect(stubIds(updated[0])).toEqual(['c', 'a']);
        expect(stubIds(updated[1])).toEqual(['b']);
        expect(stubIds(state[1])).toEqual(['b', 'c']);
    });

    it('returns the same state when there is only one column', () => {
        const state = [makeColumn('col-1', [makeStub('a')])];

        expect(demoteStubHelper(state, 0, 'a')).toBe(state);
    });

    it('returns the same state from the first column', () => {
        const state = buildState();

        expect(demoteStubHelper(state, 0, 'a')).toBe(state);
    });

    it('returns the same state when the study is not in the column', () => {
        const state = buildState();

        expect(demoteStubHelper(state, 1, 'missing')).toBe(state);
    });
});

describe('promoteAllUncategorizedHelper', () => {
    it('moves every study without an exclusion to the end of the second column, keeping their order', () => {
        const state = [
            makeColumn('col-1', [
                makeStub('a'),
                makeStub('b'),
                makeStub('excluded', { exclusionTag: 'some-exclusion' }),
                makeStub('c'),
            ]),
            makeColumn('col-2', [makeStub('already-promoted')]),
            makeColumn('col-3', [makeStub('included')]),
        ];

        const updated = promoteAllUncategorizedHelper(state);

        expect(stubIds(updated[0])).toEqual(['excluded']);
        expect(stubIds(updated[1])).toEqual(['already-promoted', 'a', 'b', 'c']);
        expect(updated[2]).toBe(state[2]);
        expect(stubIds(state[0])).toEqual(['a', 'b', 'excluded', 'c']);
    });

    it('returns the same state when there is only one column', () => {
        const state = [makeColumn('col-1', [makeStub('a')])];

        expect(promoteAllUncategorizedHelper(state)).toBe(state);
    });
});

describe('addTagToStubHelper', () => {
    it('adds a copy of the tag to the study', () => {
        const newTag = tag('needs-review');
        const state = [makeColumn('col-1', [makeStub('a', { tags: [tag('existing')] })])];

        const updated = addTagToStubHelper(state, 0, 'a', newTag);

        expect(updated[0].stubStudies[0].tags).toEqual([tag('existing'), newTag]);
        expect(updated[0].stubStudies[0].tags[1]).not.toBe(newTag);
        expect(state[0].stubStudies[0].tags).toEqual([tag('existing')]);
    });

    it('returns the same state when the study already has the tag', () => {
        const state = [makeColumn('col-1', [makeStub('a', { tags: [tag('existing')] })])];

        expect(addTagToStubHelper(state, 0, 'a', tag('existing'))).toBe(state);
    });

    it('returns the same state when the study is not in the column', () => {
        const state = [makeColumn('col-1', [makeStub('a')])];

        expect(addTagToStubHelper(state, 0, 'missing', tag('new'))).toBe(state);
    });
});

describe('removeTagFromStubHelper', () => {
    it('removes the tag from the study', () => {
        const state = [makeColumn('col-1', [makeStub('a', { tags: [tag('keep'), tag('remove')] })])];

        const updated = removeTagFromStubHelper(state, 0, 'a', 'remove');

        expect(updated[0].stubStudies[0].tags).toEqual([tag('keep')]);
        expect(state[0].stubStudies[0].tags).toEqual([tag('keep'), tag('remove')]);
    });

    it('returns the same state when the study is not in the column', () => {
        const state = [makeColumn('col-1', [makeStub('a')])];

        expect(removeTagFromStubHelper(state, 0, 'missing', 'remove')).toBe(state);
    });
});

describe('setExclusionForStubHelper', () => {
    it('sets the exclusion on the study', () => {
        const state = [makeColumn('col-1', [makeStub('a'), makeStub('b')])];

        const updated = setExclusionForStubHelper(state, 0, 'a', 'some-exclusion');

        expect(updated[0].stubStudies.map((stub) => stub.exclusionTag)).toEqual(['some-exclusion', null]);
        expect(state[0].stubStudies[0].exclusionTag).toBeNull();
    });

    it('clears the exclusion when given null', () => {
        const state = [makeColumn('col-1', [makeStub('a', { exclusionTag: 'some-exclusion' })])];

        expect(setExclusionForStubHelper(state, 0, 'a', null)[0].stubStudies[0].exclusionTag).toBeNull();
    });

    it('returns the same state when the study is not in the column', () => {
        const state = [makeColumn('col-1', [makeStub('a')])];

        expect(setExclusionForStubHelper(state, 0, 'missing', 'some-exclusion')).toBe(state);
    });
});

describe('createNewExclusionHelper', () => {
    const buildCuration = () =>
        ({
            exclusionTags: [tag('existing', true)],
            prismaConfig: {
                isPrisma: true,
                identification: { exclusionTags: [] },
                screening: { exclusionTags: [tag('existing-screening', true)] },
                eligibility: { exclusionTags: [] },
            },
        }) as unknown as ICurationMetadata;

    it('adds a copy of the exclusion to the project exclusions when there is no phase', () => {
        const curation = buildCuration();
        const newExclusion = tag('new', true);

        const updated = createNewExclusionHelper(curation, newExclusion, undefined);

        expect(updated.exclusionTags).toEqual([tag('existing', true), newExclusion]);
        expect(updated.exclusionTags[1]).not.toBe(newExclusion);
        expect(updated.prismaConfig).toBe(curation.prismaConfig);
        expect(curation.exclusionTags).toEqual([tag('existing', true)]);
    });

    it('adds the exclusion only to the given PRISMA phase', () => {
        const curation = buildCuration();

        const updated = createNewExclusionHelper(curation, tag('new', true), 'screening');

        expect(updated.prismaConfig.screening.exclusionTags).toEqual([
            tag('existing-screening', true),
            tag('new', true),
        ]);
        expect(updated.prismaConfig.identification).toBe(curation.prismaConfig.identification);
        expect(updated.prismaConfig.eligibility).toBe(curation.prismaConfig.eligibility);
        expect(updated.exclusionTags).toBe(curation.exclusionTags);
        expect(curation.prismaConfig.screening.exclusionTags).toEqual([tag('existing-screening', true)]);
    });

    it('does not add an exclusion that already exists', () => {
        const curation = buildCuration();

        expect(createNewExclusionHelper(curation, tag('existing', true), undefined)).toEqual(curation);
        expect(createNewExclusionHelper(curation, tag('existing-screening', true), 'screening')).toEqual(curation);
    });
});

describe('addOrUpdateStudyListStatusHelper', () => {
    const buildState = (): IStudyExtractionStatus[] => [
        { id: 'study-1', status: EExtractionStatus.UNCATEGORIZED },
        { id: 'study-2', status: EExtractionStatus.SAVEDFORLATER },
    ];

    it('adds a status for a new study to the top of the list', () => {
        const state = buildState();

        const updated = addOrUpdateStudyListStatusHelper(state, 'study-3', EExtractionStatus.COMPLETED);

        expect(updated).toEqual([{ id: 'study-3', status: EExtractionStatus.COMPLETED }, ...buildState()]);
        expect(state).toEqual(buildState());
    });

    it('updates the status of a study already in the list', () => {
        const state = buildState();

        const updated = addOrUpdateStudyListStatusHelper(state, 'study-2', EExtractionStatus.COMPLETED);

        expect(updated).toEqual([
            { id: 'study-1', status: EExtractionStatus.UNCATEGORIZED },
            { id: 'study-2', status: EExtractionStatus.COMPLETED },
        ]);
        expect(state).toEqual(buildState());
    });
});

describe('replaceStudyListStatusIdHelper', () => {
    const buildState = (): IStudyExtractionStatus[] => [
        { id: 'study-1', status: EExtractionStatus.COMPLETED },
        { id: 'study-2', status: EExtractionStatus.SAVEDFORLATER },
    ];

    it('replaces the study id and keeps its status', () => {
        const state = buildState();

        const updated = replaceStudyListStatusIdHelper(state, 'study-1', 'study-1-clone');

        expect(updated).toEqual([
            { id: 'study-1-clone', status: EExtractionStatus.COMPLETED },
            { id: 'study-2', status: EExtractionStatus.SAVEDFORLATER },
        ]);
        expect(state).toEqual(buildState());
    });

    it('leaves the list unchanged when the study is not in it', () => {
        expect(replaceStudyListStatusIdHelper(buildState(), 'missing', 'study-3')).toEqual(buildState());
    });

    it('leaves the list unchanged when the new id is already in it', () => {
        expect(replaceStudyListStatusIdHelper(buildState(), 'study-1', 'study-2')).toEqual(buildState());
    });
});

describe('setGivenStudyStatusesAsCompleteHelper', () => {
    it('marks every given study as completed and skips empty ids', () => {
        expect(setGivenStudyStatusesAsCompleteHelper(['study-1', '', 'study-2'])).toEqual([
            { id: 'study-1', status: EExtractionStatus.COMPLETED },
            { id: 'study-2', status: EExtractionStatus.COMPLETED },
        ]);
    });
});

describe('generateNewProjectData', () => {
    it('creates an empty CBMA project with the given name and description', () => {
        expect(generateNewProjectData(CBMA, 'My project', 'About it')).toEqual({
            name: 'My project',
            type: ProjectReturnTypeEnum.Cbma,
            description: 'About it',
            provenance: {
                type: CBMA,
                curationMetadata: {
                    columns: [],
                    prismaConfig: {
                        isPrisma: false,
                        identification: { exclusionTags: [] },
                        screening: { exclusionTags: [] },
                        eligibility: { exclusionTags: [] },
                    },
                    infoTags: [],
                    exclusionTags: [],
                    identificationSources: [],
                    imports: [],
                },
                extractionMetadata: {
                    studysetId: undefined,
                    annotationId: undefined,
                    studyStatusList: [],
                },
                metaAnalysisMetadata: {
                    canEditMetaAnalyses: false,
                },
            },
        });
    });

    it('creates an IBMA project with an empty name and description when none are given', () => {
        const project = generateNewProjectData(IBMA);

        expect(project.type).toBe(ProjectReturnTypeEnum.Ibma);
        expect(project.provenance?.type).toBe(IBMA);
        expect(project.name).toBe('');
        expect(project.description).toBe('');
    });
});
