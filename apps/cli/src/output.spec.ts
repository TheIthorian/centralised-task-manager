import { describe, it, expect } from 'vitest';
import { formatJson, formatTable } from './output.js';

describe('formatJson', () => {
    it('returns pretty-printed JSON string', () => {
        const result = formatJson({ id: '1', title: 'test' });
        expect(result).toBe(JSON.stringify({ id: '1', title: 'test' }, null, 2));
    });
});

describe('formatTable', () => {
    it('returns a non-empty string table', () => {
        const result = formatTable(['ID', 'Title'], [['1', 'Buy milk']]);
        expect(typeof result).toBe('string');
        expect(result).toContain('Buy milk');
    });

    it('includes all column headers', () => {
        const result = formatTable(['ID', 'Title', 'Status'], [['1', 'Task', 'done']]);
        expect(result).toContain('ID');
        expect(result).toContain('Title');
        expect(result).toContain('Status');
    });
});
