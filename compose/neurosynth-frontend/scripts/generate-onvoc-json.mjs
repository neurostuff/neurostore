import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLASS_ID_COLUMN = 'Class ID';
const LABEL_COLUMN = 'Preferred Label';
const PARENTS_COLUMN = 'Parents';
const OBSOLETE_COLUMN = 'Obsolete';

const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];

        if (inQuotes) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                field += character;
            }
            continue;
        }

        if (character === '"') {
            inQuotes = true;
        } else if (character === ',') {
            row.push(field);
            field = '';
        } else if (character === '\n' || character === '\r') {
            if (character === '\r' && text[index + 1] === '\n') {
                index += 1;
            }
            row.push(field);
            field = '';
            rows.push(row);
            row = [];
        } else {
            field += character;
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((parsedRow) => parsedRow.some((value) => value.trim() !== ''));
};

const splitPipeList = (value) =>
    value
        .split('|')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

const toLocalId = (classId) => {
    const segments = classId.split('/').filter((segment) => segment.length > 0);
    return segments[segments.length - 1] ?? classId;
};

const rowsToRecords = (rows) => {
    const [headerRow, ...dataRows] = rows;
    const columnIndexByName = new Map(headerRow.map((name, index) => [name, index]));
    const requiredColumns = [CLASS_ID_COLUMN, LABEL_COLUMN, PARENTS_COLUMN];
    const missingColumns = requiredColumns.filter((column) => !columnIndexByName.has(column));
    if (missingColumns.length > 0) {
        throw new Error(`CSV is missing required columns: ${missingColumns.join(', ')}`);
    }

    const classIdIndex = columnIndexByName.get(CLASS_ID_COLUMN);
    const labelIndex = columnIndexByName.get(LABEL_COLUMN);
    const parentsIndex = columnIndexByName.get(PARENTS_COLUMN);
    const obsoleteIndex = columnIndexByName.get(OBSOLETE_COLUMN);

    return dataRows.map((row) => ({
        classId: row[classIdIndex]?.trim() ?? '',
        label: row[labelIndex]?.trim() ?? '',
        parentIds: splitPipeList(row[parentsIndex] ?? ''),
        isObsolete: (row[obsoleteIndex] ?? '').trim().toUpperCase() === 'TRUE',
    }));
};

const compareLabels = (left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });

const buildOnvocTree = (records) => {
    const recordByClassId = new Map();
    const childIdsByParentId = new Map();

    for (const record of records) {
        if (!record.classId || record.isObsolete) {
            continue;
        }
        recordByClassId.set(record.classId, record);
    }

    for (const record of recordByClassId.values()) {
        for (const parentId of record.parentIds) {
            if (!recordByClassId.has(parentId)) {
                continue;
            }
            const siblings = childIdsByParentId.get(parentId) ?? [];
            siblings.push(record.classId);
            childIdsByParentId.set(parentId, siblings);
        }
    }

    const buildNode = (classId, ancestorIds) => {
        const record = recordByClassId.get(classId);
        if (!record || ancestorIds.has(classId)) {
            return null;
        }

        const nextAncestorIds = new Set(ancestorIds);
        nextAncestorIds.add(classId);

        const children = (childIdsByParentId.get(classId) ?? [])
            .map((childId) => buildNode(childId, nextAncestorIds))
            .filter((child) => child !== null)
            .sort(compareLabels);

        const node = {
            id: toLocalId(record.classId),
            label: record.label,
        };
        if (children.length > 0) {
            node.children = children;
        }
        return node;
    };

    return [...recordByClassId.values()]
        .filter((record) => record.parentIds.length === 0)
        .map((record) => buildNode(record.classId, new Set()))
        .filter((node) => node !== null)
        .sort(compareLabels);
};

export const generateOnvocJson = (csvPath, version) => {
    if (version === undefined || version === null || String(version).trim() === '') {
        throw new Error('A version number is required');
    }

    const normalizedVersion = String(version).trim();
    const resolvedCsvPath = path.resolve(csvPath);
    const csvText = fs.readFileSync(resolvedCsvPath, 'utf8');
    const tree = buildOnvocTree(rowsToRecords(parseCsv(csvText)));
    const output = {
        version: normalizedVersion,
        tree,
    };

    const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(scriptDirectory, '..');
    const outputDirectory = path.join(projectRoot, 'src', 'assets', 'config');
    const outputPath = path.join(outputDirectory, `onvoc-${normalizedVersion}.json`);
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    return outputPath;
};

const isDirectRun =
    process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    const csvPath = process.argv[2];
    const version = process.argv[3];
    if (!csvPath || !version) {
        console.error('Usage: node scripts/generate-onvoc-json.mjs <path-to-onvoc.csv> <version>');
        process.exit(1);
    }

    const outputPath = generateOnvocJson(csvPath, version);
    console.log(`Wrote ${outputPath}`);
}
