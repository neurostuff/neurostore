/** The copy of a paper its text was read from, as a parsed paper's `text_copy` holds it. */
export interface TextCopy {
    version?: string | null;
    license?: { license_id?: string; stated_as?: string | null } | null;
}

const VERSIONS: Record<string, string> = { vor: 'VoR', am: 'accepted manuscript', submitted: 'submitted manuscript' };

const LICENSES: Record<string, string> = {
    'all-rights-reserved': 'all rights reserved',
    'public-domain': 'public domain',
    other: 'other licence',
};

function licenseName(licenseId: string | undefined): string {
    if (!licenseId) return 'licence unknown';
    return LICENSES[licenseId] ?? licenseId.toUpperCase();
}

/** The copy's version and licence, as "VoR · CC-BY" or "submitted manuscript · all rights reserved". */
export function copyNote(copy: TextCopy): string {
    const version = (copy.version && VERSIONS[copy.version]) ?? 'version unknown';
    return `${version} · ${licenseName(copy.license?.license_id)}`;
}
