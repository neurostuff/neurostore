import { vi } from 'vitest';

const useUpdateAnnotationInDB = vi.fn().mockReturnValue(vi.fn());
const useUpdateAnnotationNotes = vi.fn().mockReturnValue(vi.fn());

export { useUpdateAnnotationInDB, useUpdateAnnotationNotes };
