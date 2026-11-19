import { board, filterAnalyses, moveKeys, moves, summary } from './grouping';
import type { ShareUpload, ShareView } from './types';

const upload = (id: string, keys: string[], over: Partial<ShareUpload> = {}): ShareUpload => ({
    id,
    filename: `${id}.nii.gz`,
    path: null,
    kind: 'statistic',
    map_type_by: 'name',
    partner_id: null,
    partner_r: null,
    partner_by: null,
    reversed: false,
    size_bytes: 1000,
    check_status: 'ok',
    problem: null,
    thresholded: false,
    analysis_keys: keys,
    assigned_by: keys.length > 0 ? 'suggestion' : null,
    label: null,
    map_type: 'z',
    fits: {},
    ...over,
});

const effectOf = (id: string, partner: string, keys: string[], over: Partial<ShareUpload> = {}) =>
    upload(id, keys, {
        kind: 'effect',
        map_type: 'effect',
        partner_id: partner,
        partner_by: 'name',
        assigned_by: keys.length > 0 ? 'set' : null,
        ...over,
    });

const view = (uploads: ShareUpload[]): ShareView => ({
    preview: false,
    status: 'uploading',
    open: true,
    closed_reason: null,
    paper: { title: 'A paper', journal: null, year: 2026, authors: null, doi: null, pmid: null, pmcid: null },
    analyses: [
        { key: 'a', name: 'Faces > Houses', description: null, points: 5 },
        { key: 'b', name: 'Houses > Faces', description: null, points: 5 },
        { key: 'c', name: 'Both', description: null, points: 5 },
    ],
    collection: {},
    software: null,
    uploads,
    issues: [],
    submitter_name: null,
    submitter_orcid: null,
    limits: { max_files: 9, max_file_bytes: 200 * 1024 * 1024, extensions: ['.nii.gz'], map_types: [] },
});

const ids = (groups: { lead: ShareUpload; members: ShareUpload[] }[]) =>
    groups.map((group) => [group.lead.id, ...group.members.map((member) => member.id)]);

test('a map with a saved guess sits in that analysis, one with none in the pool', () => {
    const { pool, lanes } = board(view([upload('1', ['a']), upload('2', [])]));
    expect(ids(pool)).toEqual([['2']]);
    expect(ids(lanes.get('a')!)).toEqual([['1']]);
});

test('every analysis has a lane, empty when nothing is on it', () => {
    const { lanes } = board(view([upload('1', ['a'])]));
    expect([...lanes.keys()]).toEqual(['a', 'b', 'c']);
    expect(lanes.get('b')).toEqual([]);
});

test('the board does not second-guess a saved guess by its fit', () => {
    const weak = upload('1', ['a'], { fits: { a: { outcome: 'no_match', score: 0.1, reason: null } } });
    expect(ids(board(view([weak])).lanes.get('a')!)).toEqual([['1']]);
});

test("an author's own choice places a map the same way, including back in the pool", () => {
    const placed = upload('1', ['b'], { assigned_by: 'author' });
    const returned = upload('2', [], { assigned_by: 'author' });
    const { pool, lanes } = board(view([placed, returned]));
    expect(ids(lanes.get('b')!)).toEqual([['1']]);
    expect(ids(pool)).toEqual([['2']]);
});

test('effect and variance maps travel with their t/z map', () => {
    const lead = upload('1', ['a']);
    const { lanes } = board(view([lead, effectOf('2', '1', ['a']), effectOf('3', '1', ['a'], { kind: 'variance' })]));
    expect(ids(lanes.get('a')!)).toEqual([['1', '2', '3']]);
});

test('a set whose t/z map has no analysis waits in the pool together', () => {
    const { pool } = board(view([upload('1', []), effectOf('2', '1', [])]));
    expect(ids(pool)).toEqual([['1', '2']]);
});

test('an effect map uploaded alone is a group of its own', () => {
    const { pool } = board(view([upload('1', [], { kind: 'effect', map_type: 'effect' })]));
    expect(ids(pool)).toEqual([['1']]);
});

test('an effect map whose partner was removed leads its own group', () => {
    const { lanes } = board(view([effectOf('2', 'gone', ['b'])]));
    expect(ids(lanes.get('b')!)).toEqual([['2']]);
});

test('an effect map the author placed apart from its t/z map is placed on its own', () => {
    const lead = upload('1', ['a']);
    const apart = effectOf('2', '1', ['b'], { assigned_by: 'author' });
    const { lanes } = board(view([lead, apart]));
    expect(ids(lanes.get('a')!)).toEqual([['1']]);
    expect(ids(lanes.get('b')!)).toEqual([['2']]);
});

test('a map on two analyses shows in both lanes', () => {
    const { lanes } = board(view([upload('1', ['a', 'b'])]));
    expect(ids(lanes.get('a')!)).toEqual([['1']]);
    expect(ids(lanes.get('b')!)).toEqual([['1']]);
});

test('files that could not be used are left off the board', () => {
    const bad = upload('1', [], { check_status: 'problem', problem: 'Not a NIfTI file.' });
    const { pool, lanes } = board(view([bad]));
    expect(pool).toEqual([]);
    expect(lanes.get('a')).toEqual([]);
});

test('groups keep the order the files came in', () => {
    const { pool } = board(view([upload('2', []), upload('1', []), upload('3', [])]));
    expect(ids(pool)).toEqual([['2'], ['1'], ['3']]);
});

test('moving a map out of the pool puts it on the chosen analysis alone', () => {
    expect(moveKeys([], 'b', null)).toEqual(['b']);
});

test('moving from one analysis to another swaps only that one', () => {
    expect(moveKeys(['a', 'b'], 'c', 'a')).toEqual(['b', 'c']);
    expect(moveKeys(['a'], 'b', 'a')).toEqual(['b']);
});

test('moving onto an analysis it is already on changes nothing else', () => {
    expect(moveKeys(['a', 'b'], 'b', 'a')).toEqual(['b']);
    expect(moveKeys(['a'], 'a', 'a')).toEqual(['a']);
});

test('removing from an analysis, or moving to the pool, drops only that analysis', () => {
    expect(moveKeys(['a', 'b'], null, 'a')).toEqual(['b']);
    expect(moveKeys(['a'], null, 'a')).toEqual([]);
});

test('searching analyses ignores case and spaces, and an empty search keeps them all', () => {
    const found = [
        { key: 'a', name: 'Faces > Houses' },
        { key: 'b', name: 'Houses > Faces' },
        { key: 'c', name: 'Both' },
    ];
    expect(filterAnalyses(found, '  ')).toHaveLength(3);
    expect(filterAnalyses(found, 'BOTH').map((analysis) => analysis.key)).toEqual(['c']);
    expect(filterAnalyses(found, 'zzz')).toEqual([]);
});

test("moving a group sends its t/z map's analyses, and any member the author placed themselves", () => {
    const lead = upload('1', ['a']);
    const followed = effectOf('2', '1', ['a']);
    const placed = effectOf('3', '1', ['a'], { assigned_by: 'author' });
    const group = { lead, members: [followed, placed] };
    expect(moves(group, 'b', 'a')).toEqual([
        { id: '1', keys: ['b'] },
        { id: '3', keys: ['b'] },
    ]);
    expect(moves(group, null, 'a')).toEqual([
        { id: '1', keys: [] },
        { id: '3', keys: [] },
    ]);
});

test('the summary counts maps, maps still on no analysis, and analyses with and without a map', () => {
    const v = view([
        upload('1', ['a']),
        upload('2', []),
        upload('3', [], { label: 'Faces only' }),
        upload('4', [], { kind: 'effect', partner_id: '2' }),
    ]);
    // Four maps came up; the unplaced t/z map and its effect map wait, the described one is dealt with.
    expect(summary(v)).toEqual({ uploaded: 4, unassigned: 2, filled: 1, empty: 2 });
});

test('with nothing uploaded all three analyses are empty', () => {
    expect(summary(view([]))).toEqual({ uploaded: 0, unassigned: 0, filled: 0, empty: 3 });
});
