interface Config {
    linkedProject?: string;
}
export declare const paths: {
    home: string;
    config: string;
};
export declare function ensureHome(): Promise<void>;
export declare function loadConfig(): Promise<Config>;
export declare function saveConfig(config: Config): Promise<void>;
export {};
