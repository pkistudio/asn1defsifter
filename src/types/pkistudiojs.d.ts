declare module '@pkistudio/pkistudiojs/core' {
  const core: {
    parseInput(input: unknown, options?: Record<string, unknown>): unknown;
    decodeOid(bytes: Uint8Array): string | undefined;
  };
  export default core;
}

declare module '@pkistudio/pkistudiojs/oid-resolver' {
  const oidResolver: {
    names: Record<string, string>;
    resolve(oid: string): string;
    create(names?: Record<string, string>): { resolve(oid: string): string };
  };
  export default oidResolver;
}

declare module '@pkistudio/pkistudiojs/viewer' {
  const viewer: unknown;
  export default viewer;
}