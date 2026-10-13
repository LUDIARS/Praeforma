import type { BuildOptions } from 'esbuild';

export declare const ENTRY: string;
export declare const OUT_FILE: string;
export declare function serverBuildOptions(serverDir: string): BuildOptions & {
  entryPoints: string[];
  outfile: string;
};
export declare function buildServer(args: { serverDir: string }): Promise<string>;
