import { classOf, type Schema } from '../../model/schema';
import extractionSchema from './schemas/extraction-record.schema.json';
import { isObject, type Json } from '../../model/paths';

export interface ClassRow {
    entity: string;
    path: string;
    class: string;
}

export interface Walked {
    classes: ClassRow[];
    wrappers: ClassRow[];
}

const ROOT = 'study';
const STUDY = 'Study';

/** The key slots a list item of each class is selected by: the storage-study schema's x-unique-keys (the extraction schema has none). */
const KEYED_BY: Record<string, string[]> = {
    Cell: ['term', 'level'],
    AnalysisGroup: ['group'],
    ModelTerm: ['name'],
    FactorLevel: ['level'],
};

const root = extractionSchema as Schema;
const defs = root.$defs as Record<string, Schema>;
const propertiesOf = (name: string): Record<string, Schema> => (defs[name]?.properties ?? {}) as Record<string, Schema>;
const isEntity = (name: string) => 'local_id' in propertiesOf(name);
const isWrapper = (name: string) => {
    const properties = propertiesOf(name);
    return 'extraction_status' in properties && 'evidence' in properties;
};

const keyText = (slot: unknown) => {
    const value = isObject(slot) ? slot.value : slot;
    return value === null || value === undefined ? '' : String(value);
};

const joinPath = (prefix: string, step: string) => (prefix ? `${prefix}.${step}` : step);

/**
 * The schema class of the record's study, every entity and every object below them, resolved from the record
 * alone by the app's classOf. Keys are {entity, path} as the backend writes them; value wrappers are listed apart.
 */
export function walkClasses(record: Json): Walked {
    const classes: ClassRow[] = [];
    const wrappers: ClassRow[] = [];
    const found = (entity: string, path: string, cls: string) => {
        const row = { entity, path, class: cls };
        classes.push(row);
        if (isWrapper(cls)) wrappers.push(row);
    };
    const visit = (entity: string, cls: string, obj: Json, prefix: string) => {
        for (const [attribute, value] of Object.entries(obj)) {
            const schema = propertiesOf(cls)[attribute];
            if (!schema || value === null || value === undefined) continue;
            const here = joinPath(prefix, attribute);
            if (isObject(value)) {
                const inner = classOf(root, schema, value);
                if (inner === undefined) continue;
                found(entity, here, inner);
                if (!isWrapper(inner)) visit(entity, inner, value, here);
            } else if (Array.isArray(value)) {
                value.forEach((item, position) => {
                    if (!isObject(item)) return;
                    const inner = classOf(root, schema, item);
                    if (inner === undefined) return;
                    if (isEntity(inner)) {
                        found(String(item.local_id), '', inner);
                        visit(String(item.local_id), inner, item, '');
                        return;
                    }
                    const keys = KEYED_BY[inner];
                    const selector = keys
                        ? keys.map((key) => `${key}=${keyText(item[key])}`).join(',')
                        : `#${position}`;
                    const step = `${here}[${selector}]`;
                    found(entity, step, inner);
                    if (!isWrapper(inner)) visit(entity, inner, item, step);
                });
            }
        }
    };
    found(ROOT, '', STUDY);
    visit(ROOT, STUDY, record, '');
    return { classes, wrappers };
}
