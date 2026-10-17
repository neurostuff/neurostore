import { sha256Hex } from './sha256';

/** The local_id the review core mints for a create_entity op: `rv_` + sha256(client_op_id)[:12], suffixed on collision. */
export async function mintLocalId(clientOpId: string, taken: ReadonlySet<string>): Promise<string> {
    const base = `rv_${(await sha256Hex(clientOpId)).slice(0, 12)}`;
    let localId = base;
    for (let n = 2; taken.has(localId); n++) localId = `${base}_${n}`;
    return localId;
}
