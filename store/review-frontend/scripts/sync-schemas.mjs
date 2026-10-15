// Usage: node scripts/sync-schemas.mjs <study_schema checkout or jsonschema export> [--commit <sha>]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const contractDir = path.resolve(here, '../src/contract');
const SCHEMAS = ['extraction-record', 'coordinate-parse'];
const DIGEST = 'study-schema.sha256';
const IN_CHECKOUT = ['src', 'study_schema', 'jsonschema'];

const fullName = (name) => `${name}.schema.json`;
const runtimeName = (name) => `${name}.runtime.schema.json`;

function schemaIn(source, file) {
    for (const candidate of [path.join(source, ...IN_CHECKOUT, file), path.join(source, file)]) {
        if (existsSync(candidate)) return candidate;
    }
    throw new Error(`no ${file} in ${source} or its ${IN_CHECKOUT.join('/')}`);
}

function commitOf(source, given) {
    if (given) return given;
    const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
    let top = '';
    try {
        top = git('rev-parse', '--show-toplevel');
    } catch {
        // not in a git work tree
    }
    if (path.resolve(top) !== path.resolve(source)) {
        throw new Error(`${source} is not the root of a git checkout; name its commit with --commit <sha>`);
    }
    return git('rev-parse', 'HEAD');
}

/** A copy of a schema with its `description` annotations removed; a property named description is kept. */
export function stripDescriptions(value) {
    if (Array.isArray(value)) return value.map(stripDescriptions);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.entries(value)
            .filter(([key, item]) => !(key === 'description' && typeof item === 'string'))
            .map(([key, item]) => [key, stripDescriptions(item)])
    );
}

export const sha256Of = (text) => createHash('sha256').update(text).digest('hex');

/** Writes each schema's runtime copy, and the digests of the full copies as `sha256sum` lists them, in `dir`. */
export function deriveCopies(dir) {
    const digests = SCHEMAS.map((name) => {
        const full = readFileSync(path.join(dir, fullName(name)), 'utf8');
        writeFileSync(path.join(dir, runtimeName(name)), `${JSON.stringify(stripDescriptions(JSON.parse(full)))}\n`);
        return `${sha256Of(full)}  ${fullName(name)}\n`;
    });
    writeFileSync(path.join(dir, DIGEST), digests.join(''));
}

export function syncSchemas(source, commit, into = contractDir) {
    const pinned = commitOf(source, commit);
    for (const name of SCHEMAS) copyFileSync(schemaIn(source, fullName(name)), path.join(into, fullName(name)));
    deriveCopies(into);
    writeFileSync(path.join(into, 'study-schema.commit'), `${pinned}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const at = args.indexOf('--commit');
    const commit = at === -1 ? undefined : args.splice(at, 2)[1];
    if (args.length !== 1) {
        console.error('usage: node scripts/sync-schemas.mjs <study_schema checkout or export> [--commit <sha>]');
        process.exit(2);
    }
    syncSchemas(path.resolve(args[0]), commit);
}
