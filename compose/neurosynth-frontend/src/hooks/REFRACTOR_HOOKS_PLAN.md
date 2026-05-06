# Reusable Plan: Refactor Hooks Using Query Key Factories

This document is a reusable blueprint for refactoring React Query hooks so they follow the same pattern as the recent `src/hooks/annotations/` query refactor.

It is intentionally generalized so you can apply it to other hook folders (e.g. `studies/`, `studysets/`, `projects/`, `analyses/`, etc.) without re-learning the tradeoffs.

## Goal

Refactor “list/detail” hooks and the related “create/update/delete” mutation hooks so that:

1. Query keys (`queryKey`) are defined in one place (a `*Queries.ts` factory file).
2. Query enabling logic is explicit (no accidental calls with `undefined` ids).
3. Query functions (`queryFn`) are consistent and return the correctly typed payload (especially when the backend OpenAPI types are too broad/unions).
4. Mutations invalidate/update the correct caches using the same query key factories.
5. Hook call sites stay compatible with future `@tanstack/react-query` v5 upgrades by using object-based options (`queryKey`, `queryFn`, `enabled`, etc.) instead of positional args.
6. Payload branches caused by endpoint flags/params (e.g. `nested`, `summary`) are explicitly typed and surfaced as separate hooks.

## Reference Implementation: What We Did in `hooks/annotations/`

### 1. Centralized query keys + query functions

- Created `src/hooks/annotations/annotationQueries.ts`.
- That file exports a small object with factory methods like:
    - `all()`: top-level “invalidate everything”
    - `lists()`: list/search cache group
    - `details()`: detail cache group
    - `byStudyset(studysetId)`: query config for list-by-parent
    - `byId(annotationId)`: query config for detail-by-id
- Each factory returns an object shaped like:
    - `{ queryKey: <stable tuple as const>, queryFn: async () => ..., enabled: boolean }`

Key point: hooks call `annotationQueries.*(...)` and do not manually construct query keys.

### 2. Added a local types shim for note relationship payloads

- Created `src/hooks/annotations/annotationQueries.types.ts`.
- This file narrows the generated `neurostore-typescript-sdk` OpenAPI union types for `notes` by using `Omit<..., 'notes'> & { notes?: Array<...> }`.
- The effect is: when hooks use the narrowed aliases, the rest of the codebase can treat `notes` as structured note collections (instead of string ids) consistently.

### 3. Refactored existing hooks to use the query config

Updated hooks now follow this pattern:

```ts
const query = annotationQueries.byId(annotationId);
return useQuery({
    ...query,
});
```

For mutations:

- They invalidate caches via `queryClient.invalidateQueries(annotationQueries.*().queryKey)`
- Delete uses `queryClient.removeQueries(annotationQueries.byId(id).queryKey)` plus list invalidation.

## Changes Applied Later (Already Done in This Repo)

When adapting this plan, treat the following as “already solved” by the annotations refactor:

### A. Update annotation notes moved to an ids-based bulk update hook

- Added `useUpdateAnnotationByAnnotationAndAnalysisIds.tsx`.
- It uses the bulk endpoint `API.NeurostoreServices.AnalysesService.annotationAnalysesPost(update)` where the payload is `NoteCollectionRequest[]`.
- On success, it invalidates the annotation detail cache using `annotationQueries.byId(annotationId).queryKey`.

### B. Update-by-id mutation supports cache write vs invalidation

- Updated `useUpdateAnnotationById.tsx` to accept `options?: { invalidateOnSuccess?: boolean }`.
- When `invalidateOnSuccess` is `true`:
    - invalidate detail + lists
- When `false`:
    - write the response directly into the detail cache via `queryClient.setQueryData(...)`.

### C. Hook exports were updated

- Updated `src/hooks/index.ts` to export the new query-driven annotation hooks and include the updated set of mutation hooks.
- Removed/replaced the old annotation update hook that no longer matched the new payload shape.

## What We Want (Non-Negotiables)

1. **One source of truth for query keys.**  
   No other file should “know” the raw `['annotations', 'detail', id]` shape.

2. **Explicit enablement.**  
   If an id parameter is optional, the query config must expose `enabled: !!id` and the hook must pass that into `useQuery`.

3. **Correct typing of relationship payloads.**  
   If the generated SDK types are unions (e.g. `notes?: Array<T> | Array<string>`), add a small local shim type file to narrow them to the shape the backend actually returns for your endpoint usage.

4. **Cache invalidation uses the same factories.**  
   Mutations should invalidate via `annotationQueries.*(...).queryKey` rather than constructing query keys inline.

5. **Prefer stable queryKey tuples (`as const`).**  
   It reduces subtle mismatches (and makes `invalidateQueries` calls more reliable).

6. **Use absolute imports for all hook refactor changes.**  
   Prefer import paths like `hooks/<resource>/<file>` or `api/<file>`; avoid `./` and `../` imports in refactored files.

7. **Use object-style React Query options for v5-forward compatibility.**  
   Keep hook calls in the `useQuery({ queryKey, queryFn, enabled, ... })` / `useMutation({ mutationFn, onSuccess, ... })` shape.

8. **Check for response type branching and split hooks when needed.**  
   If endpoint arguments change response shape (for example `nested`/`summary` toggles), add a local `*.types.ts` file and create separate hooks per shape (e.g. `useGetXNonNestedById`, `useGetXNestedById`, `useGetXSummaryById`) rather than exposing a single ambiguous return type.

## What We Do Not Want (Common Failure Modes)

1. **Do not scatter query keys.**  
   Avoid `invalidateQueries(['annotations', 'details', id])` in many places.

2. **Do not call list/detail endpoints with empty ids.**  
   Use `enabled` gates. Never rely on API calls “tolerating” `''`.

3. **Do not let OpenAPI union types leak into business logic.**  
   If `notes` can be typed as `Array<string> | Array<NoteCollectionReturn>`, that ambiguity should be resolved near the hook layer (via a local `*.types.ts` shim).

4. **Do not keep one overloaded GET hook when endpoint flags branch payload shape.**  
   If `useGetXById(id, nested, summary)` can return materially different payloads, split the hook into shape-specific hooks and type each one explicitly.

5. **Do not refactor unrelated UI/components as part of the hook plan.**  
   Keep the diff minimal: focus on the hook layer, then only touch UI if the types/data shape requires it.

6. **Do not create any new files such as annotationMutations.ts, or index.ts.** Keep the query invalidation logic in the hooks. They already provide a sufficient layer of abstraction. We simply want an annotationQueries.ts file.

## Detailed Refactor Steps (Template for Any Hook Folder)

Assume you are refactoring a folder like `src/hooks/<resource>/`.

### Step 1: Inventory the endpoints you need

For that resource, identify:

1. List/search endpoint(s)
2. Detail endpoint
3. Any “nested” or “relationship” endpoints that power the resource’s UI editing
    - Example from annotations:
        - list by `studysetId`
        - detail by `annotationId`
        - update notes via analyses service (`annotationAnalysesPost`)

Record the exact `API.<Service>.<endpoint>(...)` calls you currently use in existing hooks.

### Step 2: Create a `*Queries.ts` factory file in the same folder

Example target: `src/hooks/<resource>/<resource>Queries.ts`.

Inside:

1. Define query key segments:
    - `all()`, `lists()`, `details()`
2. Define parameterized factories:
    - `byId(id)`
    - `byParent(parentId)` (if relevant)
3. Each factory returns `{ queryKey, queryFn, enabled }`.

Rules:

- `queryKey` must be stable and typed as const (`as const`).
- `enabled` must be boolean-only; the hook does not have to guess.
- `queryFn` should call the API and return the raw `res.data.<shape>` exactly once (no transformation unless the existing hook already did it intentionally via `select`).

### Step 3: Add a local `*.types.ts` shim when SDK types are broad or branch by endpoint args

When do you need it?

- If you see OpenAPI unions like “notes can be string ids OR nested objects”
- If endpoint parameters (`nested`, `summary`, `includeX`, etc.) change the returned relationship shape
- If existing code had to cast to `any`

What to do:

1. Import the relevant generated SDK types (`NoteCollectionReturn`, `NoteCollectionRequest`, etc.)
2. Create narrowed aliases with `Omit<..., 'relationshipField'> & { relationshipField?: Array<NarrowedType> }`
3. Export those aliases so all the hooks in the folder use the same narrow type.
4. If argument-driven branching exists, define one alias per payload shape and name them clearly (e.g. `XReturnNonNested`, `XReturnNested`, `XReturnSummary`).

This mirrors `annotationQueries.types.ts`.

### Step 4: Refactor “GET/list” hooks to consume the query factories

For each existing `useGetXById`, `useGetXByParentId`, etc.:

1. Replace the inline `useQuery(['...', ...], () => API....)` with:
    - `const query = xQueries.byId(id)` (or similar)
2. Call:
    - `useQuery({ ...query, select: ... })`
3. Preserve any existing `select` behavior (sorting, mapping) unless you have a reason to change it.
4. If the endpoint has argument-driven payload branching, split into multiple hooks (e.g. `useGetXNonNestedById`, `useGetXNestedById`, `useGetXSummaryById`) so each hook has one concrete return type.

React Query API shape guideline:

- Prefer object options everywhere so migration to v5 is low-risk:
    - `useQuery({ queryKey, queryFn, enabled, select, staleTime, ... })`
    - `useMutation({ mutationFn, onSuccess, onError, ... })`
- Avoid positional overloads like `useQuery(queryKey, queryFn, options)` in newly refactored hooks.

### Step 5: Refactor mutations to invalidate using query factories

For each `useCreate*`, `useUpdate*`, `useDelete*`:

1. Update the `onSuccess` invalidation calls to use the same `*Queries.ts` factories.
2. Choose the correct cache action:
    - `invalidateQueries(...)` when you want a refetch
    - `removeQueries(...)` when you want to drop stale detail cache (e.g. delete)
    - `setQueryData(...)` for “no refetch” flows (as in `useUpdateAnnotationById` when `invalidateOnSuccess` is false)
3. Keep optional behavior (like `invalidateOnSuccess`) consistent with how the annotation hooks do it.

### Step 6: Update `src/hooks/index.ts`

If your refactor adds/removes hooks, update exports accordingly.

Keep import paths consistent with the current folder style.
Use absolute imports for newly added/updated hook imports.

### Step 7: Update/adjust tests and Cypress only if the refactor changes user-visible behavior

Even if data shape is unchanged, cache invalidation timing can affect e2e flows.

Minimum checks:

1. Run the unit tests for the touched hook files (or whole file if that’s how the repo structures it)
2. Run Cypress for the spec files that exercise the affected pages

Use the repo’s documented commands for where Cypress/vitest should be run.

## Checklist (Copy/Paste)

Before:

- [ ] I listed every list/detail/relationship endpoint needed for this resource.
- [ ] I identified which query keys the UI depends on (where it reads from react-query).

During:

- [ ] I created a `*Queries.ts` file with stable query keys and `enabled` logic.
- [ ] I added a `*.types.ts` shim if any SDK union types leak into my hooks.
- [ ] I explicitly checked whether endpoint args (like `nested`/`summary`) branch response types.
- [ ] If response types branch, I created shape-specific types and split the hook into multiple GET hooks.
- [ ] Each GET hook uses object options (`useQuery({ ...query })` or `useQuery({ queryKey, queryFn, enabled, ... })`).
- [ ] All imports in touched files are absolute (no relative import paths).

After:

- [ ] Each mutation invalidates/updates caches using the `*Queries.ts` factories.
- [ ] `src/hooks/index.ts` exports match the new/changed hooks.
- [ ] The app compiles and the affected pages load without undefined-id API calls.
- [ ] Tests and Cypress are updated if they fail (fixtures/intercepts may need minor adjustments).
