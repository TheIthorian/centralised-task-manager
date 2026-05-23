// Node 18+ exposes native fetch globally. Declare minimal types for TypeScript.
declare function fetch(input: string | URL, init?: RequestInit): Promise<Response>;

interface RequestInit {
    method?: string;
    headers?: Record<string, string>;
    body?: string | URLSearchParams | null;
}

interface Response {
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}
