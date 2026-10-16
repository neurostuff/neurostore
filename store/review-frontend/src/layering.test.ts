import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.dirname(new URL(import.meta.url).pathname);

/** The layers each layer's modules may not reach, through any chain of imports. */
const FORBIDDEN: Record<string, string[]> = {
    store: ['inspector', 'coordinates', 'review'],
    model: ['text', 'inspector'],
    api: ['inspector'],
};

type Sources = Map<string, string>;

const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(?\s*['"]([^'"]+)['"]/g;

const isModule = (file: string) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file);

function resolve(sources: Sources, from: string, specifier: string): string | undefined {
    if (!specifier.startsWith('.')) return undefined;
    const base = path.resolve(path.dirname(from), specifier);
    return [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find(
        (candidate) => isModule(candidate) && sources.has(candidate)
    );
}

function importsOf(sources: Sources, file: string): string[] {
    const source = sources.get(file) ?? '';
    return [...source.matchAll(IMPORT)].flatMap(([, from, dynamic]) => resolve(sources, file, from ?? dynamic) ?? []);
}

/** Every module of `sources` that `file` reaches, itself left out. */
function reached(sources: Sources, file: string): Set<string> {
    const seen = new Set<string>();
    const todo = importsOf(sources, file);
    for (let next = todo.pop(); next !== undefined; next = todo.pop()) {
        if (seen.has(next)) continue;
        seen.add(next);
        todo.push(...importsOf(sources, next));
    }
    seen.delete(file);
    return seen;
}

/** The modules of the `forbidden` layers under `root` that `file` reaches, relative to `root`. */
function crossings(sources: Sources, root: string, file: string, forbidden: string[]): string[] {
    return [...reached(sources, file)]
        .map((module) => path.relative(root, module))
        .filter((module) => forbidden.includes(module.split(path.sep)[0]))
        .sort();
}

/** The modules under `dir`, in its subdirectories too. */
function modulesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const at = path.join(dir, entry.name);
        if (entry.isDirectory()) return modulesUnder(at);
        return isModule(entry.name) ? [at] : [];
    });
}

describe('the import walk', () => {
    const root = '/app/src';
    const graph: Sources = new Map([
        [`${root}/store/a.ts`, "import { b } from './b';\nimport { useState } from 'react';"],
        [`${root}/store/b.ts`, "export { c } from '../model/nested/c';"],
        [`${root}/model/nested/c.ts`, "import type { Bad } from '../../inspector/bad';"],
        [`${root}/model/clean.ts`, "import { c } from './nested/c';"],
        [`${root}/inspector/bad.ts`, "import { a } from '../store/a';"],
    ]);

    it('follows every chain of imports, a re-export and a type import too, through a cycle', () => {
        expect([...reached(graph, `${root}/store/a.ts`)].sort()).toEqual([
            `${root}/inspector/bad.ts`,
            `${root}/model/nested/c.ts`,
            `${root}/store/b.ts`,
        ]);
    });

    it('finds the planted bad import a module reaches through others', () => {
        expect(crossings(graph, root, `${root}/model/clean.ts`, ['inspector'])).toEqual(['inspector/bad.ts']);
        expect(crossings(graph, root, `${root}/store/b.ts`, ['text'])).toEqual([]);
    });
});

describe.each(Object.entries(FORBIDDEN))('a %s module', (layer, forbidden) => {
    const sources: Sources = new Map(modulesUnder(SRC).map((file) => [file, readFileSync(file, 'utf8')]));
    it.each(modulesUnder(path.join(SRC, layer)).map((file) => [path.relative(SRC, file), file]))(
        `%s reaches no module of ${forbidden.join(', ')}`,
        (_, file) => {
            expect(crossings(sources, SRC, file, forbidden)).toEqual([]);
        }
    );
});
