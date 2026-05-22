import Table from 'cli-table3';

/** Serialize value to pretty-printed JSON string. */
export function formatJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

/** Render rows as a terminal table with the given column headers. */
export function formatTable(headers: string[], rows: string[][]): string {
    const table = new Table({ head: headers });
    table.push(...rows);
    return table.toString();
}
