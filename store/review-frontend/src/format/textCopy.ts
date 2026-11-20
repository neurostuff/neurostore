/** The copy of a paper its text was read from, as a parsed paper's `text_copy` holds it. */
export interface TextCopy {
    version?: string | null;
    license?: { license_id?: string; stated_as?: string | null } | null;
}

const VERSIONS: Record<string, string> = { vor: 'VoR', am: 'accepted manuscript', submitted: 'submitted manuscript' };

const LICENSES: Record<string, string> = {
    all_rights_reserved: 'all rights reserved',
    public_domain: 'public domain',
    other: 'other licence',
};

/** A licence as people write it: `cc_by_nc` is CC-BY-NC. */
function licenseName(licenseId: string | undefined): string {
    if (!licenseId) return 'licence unknown';
    return LICENSES[licenseId] ?? licenseId.replaceAll('_', '-').toUpperCase();
}

/** The copy's version and licence, as "VoR · CC-BY" or "submitted manuscript · all rights reserved". */
export function copyNote(copy: TextCopy): string {
    const version = (copy.version && VERSIONS[copy.version]) ?? 'version unknown';
    return `${version} · ${licenseName(copy.license?.license_id)}`;
}
