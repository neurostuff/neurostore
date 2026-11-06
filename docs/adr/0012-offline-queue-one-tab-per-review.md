# 0012. Unsaved ops are kept on the device, and one tab edits a review

Status: accepted, built

## Context

Saving is continuous, and the requirement is that closing the tab loses nothing, even offline. Pending ops used to live only in memory, flushed with a keepalive request on hide or unload, and that request fails offline. Persisting the queue in the browser raises a second problem: two tabs on one review would each restore and replay the same kept ops, or overwrite each other's queue. The server already serializes writers (`expected_last_seq`, a row lock), but it cannot tell that two tabs hold copies of the same unsent edits.

## Decision

- **One tab per review.** `store/review-frontend/src/store/reviewSession.ts` takes a Web Lock named `neurostore-review:<review id>` with `ifAvailable`. The tab holding it edits. Any other tab opens the review read-only: it is browsable, but its edit controls are disabled, its edit panels cannot open, and every mutator of the session store passes one edit guard that refuses.
- **Pending ops on the device.** The tab with the lock keeps its pending ops, their emitBatch groups and their evidence intents in IndexedDB (`src/store/deviceQueue.ts`, database `neurostore-review`, one entry per review id, with `QUEUE_VERSION`). It writes at most every 250 ms, and at once on hide or close.
- **One replay.** On load the kept ops go through the same pure replay as the rebase after a stale 409 (`src/store/keptOps.ts`), against the fresh bundle. The entry stores no `expected_last_seq`: the replay rebuilds evidence edits from their intents against whatever the server holds now.
- **Failing safe.** A queue written by another version is dropped with a notice. If IndexedDB is missing or fails, the tab edits in memory and says that edits are not kept. A browser without Web Locks edits as if it held the lock.

## Consequences

- An edit made offline survives closing the tab, and is sent when the review is next opened on that device.
- A second tab cannot edit until the first lets go of the lock, so a reviewer who expects two editable tabs gets a read-only one.
- The kept ops belong to one device and one browser profile. Edits made offline on one machine are not visible on another until they are sent.
- Undo history is not kept, so after a reload the restored ops are pending but cannot be undone step by step.
- An entity created before its id was minted, then kept and restored, does not get the focus back after a reload.

## Rejected

- **Keep the queue in memory and rely on keepalive.** It fails offline, which is the case that matters.
- **localStorage.** Synchronous, small, and shared between tabs without a lock.
- **Let several tabs edit and merge their queues.** Each tab's replay would need to know which of the other's ops are already sent. The server's 409 rebase already handles tabs on different devices; on one device, a lock is simpler and exact.
