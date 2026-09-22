let counter = 0;

/** Short, readable, collision-free-enough ids for a client-side mock store. */
export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}
