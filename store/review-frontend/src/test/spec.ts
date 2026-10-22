import Ajv from 'ajv';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateOpBatch } from './schemas';

interface Parameter {
    name: string;
    in: 'path' | 'query' | 'header';
    required?: boolean;
    schema: object;
}

interface Operation {
    parameters?: Parameter[];
    requestBody?: { content: { 'application/json': { schema: object } } };
    responses?: Record<string, { content?: { 'application/json': { schema: object } } }>;
    security?: Record<string, unknown>[];
}

type PathItem = Record<string, Operation> & { parameters?: Parameter[] };

const SPEC = path.resolve(__dirname, '../../../backend/neurostore/openapi/neurostore-openapi.yml');
const spec = load(readFileSync(SPEC, 'utf8')) as { paths: Record<string, PathItem> };
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema({ ...spec, $id: 'spec' });
const queryAjv = new Ajv({ allErrors: true, strict: false, coerceTypes: true });

export const API_BASE = 'https://api.test/api';

function match(pathname: string): { template: string; item: PathItem } | null {
    for (const [template, item] of Object.entries(spec.paths)) {
        const pattern = new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`);
        if (pattern.test(pathname)) return { template, item };
    }
    return null;
}

const errorsOf = (where: string, validate: { errors?: unknown[] | null }) =>
    (validate.errors ?? []).map((e) => `${where}: ${JSON.stringify(e)}`);

function compile(schema: object) {
    const ref = (schema as { $ref?: string }).$ref;
    return ref ? ajv.getSchema(`spec${ref}`)! : ajv.compile(schema);
}

/** Every way the request breaks the neurostore spec; [] for a valid one. */
export function requestProblems(method: string, url: string, headers: Headers, body: unknown): string[] {
    const { pathname, searchParams } = new URL(url);
    if (!pathname.startsWith(new URL(API_BASE).pathname)) return [`${url} is outside the API`];
    const found = match(pathname.slice(new URL(API_BASE).pathname.length));
    if (!found) return [`no path in the spec for ${pathname}`];
    const operation = found.item[method.toLowerCase()];
    if (!operation) return [`${found.template} has no ${method}`];
    const problems: string[] = [];
    const query = (operation.parameters ?? []).filter((p) => p.in === 'query');
    for (const name of searchParams.keys()) {
        const parameter = query.find((p) => p.name === name);
        if (!parameter) {
            problems.push(`unknown query parameter ${name}`);
            continue;
        }
        const validate = queryAjv.compile({ type: 'object', properties: { value: parameter.schema } });
        if (!validate({ value: searchParams.get(name) })) problems.push(...errorsOf(name, validate));
    }
    if (operation.security?.length && !/^Bearer \S+$/.test(headers.get('Authorization') ?? ''))
        problems.push('no bearer token');
    const schema = operation.requestBody?.content['application/json'].schema;
    if (schema === undefined && body !== undefined) problems.push(`${found.template} ${method} takes no body`);
    if (schema !== undefined) {
        const validate = compile(schema);
        if (!validate(body)) problems.push(...errorsOf('body', validate));
        if ((schema as { $ref?: string }).$ref?.endsWith('/review-op-batch')) {
            const { ops } = body as { ops: unknown };
            if (!validateOpBatch({ ops })) problems.push(...errorsOf('ops', validateOpBatch));
        }
    }
    return problems;
}

/** Every way the response breaks the neurostore spec for its status; [] when the spec has no body for it. */
export function responseProblems(method: string, url: string, status: number, body: unknown): string[] {
    const found = match(new URL(url).pathname.slice(new URL(API_BASE).pathname.length));
    const schema =
        found?.item[method.toLowerCase()]?.responses?.[String(status)]?.content?.['application/json']?.schema;
    if (!schema) return [];
    const validate = compile(schema);
    return validate(body) ? [] : errorsOf(`${status} body`, validate);
}
