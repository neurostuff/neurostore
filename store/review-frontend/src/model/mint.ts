/** The local_id the review core mints for a create_entity op: `rv_` + sha256(client_op_id)[:12], suffixed on collision. */
export async function mintLocalId(clientOpId: string, taken: ReadonlySet<string>): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientOpId));
    const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const base = `rv_${hex.slice(0, 12)}`;
    let localId = base;
    for (let n = 2; taken.has(localId); n++) localId = `${base}_${n}`;
    return localId;
}
