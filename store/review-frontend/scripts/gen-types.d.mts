export const schemaDir: string;
export const specFile: string;
export const outputDir: string;
export const apiComponents: Record<string, string>;
export function generateTypes(): Promise<Record<string, string>>;
