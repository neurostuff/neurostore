import { vi } from 'vitest';

const useUpdateDBWithAnnotationFromStore = vi.fn().mockReturnValue(vi.fn());
const useUpdateAnnotationNotes = vi.fn().mockReturnValue(vi.fn());

export { useUpdateDBWithAnnotationFromStore, useUpdateAnnotationNotes };
