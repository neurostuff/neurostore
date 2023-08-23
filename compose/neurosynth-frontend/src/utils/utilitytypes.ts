// The Optional Type takes a type and sets the given properties as optional.
// How does it work?
//      Pick<Partial<T>, K> selects the optional (K) properties from Partial<T>.
//      Omit<T, K> selects all the properties except for (K).
//      The & creates a union, effectively combining all optional K properties with the original object minus K properties.
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
