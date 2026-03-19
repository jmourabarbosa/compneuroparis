import { OutputBundleConfig } from "@apphosting/common";
export declare function localBuild(projectRoot: string, framework?: string): Promise<OutputBundleConfig>;
export declare function adapterBuild(projectRoot: string, framework: string): Promise<OutputBundleConfig>;
