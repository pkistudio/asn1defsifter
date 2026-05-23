declare module '@pkistudio/pkistudiojs/core' {
  const core: {
    parseInput(input: unknown, options?: Record<string, unknown>): unknown;
  };
  export default core;
}