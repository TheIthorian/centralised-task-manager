import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ValidationError } from '@ctm/errors';
import { DataPortabilityController } from './data-portability.controller.js';
import { ExportService } from './export.service.js';
import { ImportService } from './import.service.js';
import { FilesService } from '../files/files.service.js';
import { JwtAuthGuard } from '../tokens/jwt-auth.guard.js';
import { Export, ExportSchema } from './schemas/export.schema.js';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import type { ExportDocument } from './schemas/export.schema.js';

const userId = new Types.ObjectId().toHexString();
const authReq = { user: { sub: userId, email: 'test@test.com' } };

const mockExportService = {
    export: vi.fn().mockResolvedValue({
        exportId: 'uuid-1',
        files: [{ filename: 'export-part-1.json', sizeBytes: 100, contentType: 'application/json', sha256: 'abc' }],
    }),
};

const mockImportService = {
    import: vi
        .fn()
        .mockResolvedValue({ imported: { tasks: 2, notifications: 1 }, skipped: { tasks: 0, notifications: 0 } }),
};

const mockFilesService = {
    readByPath: vi.fn(),
};

describe('DataPortabilityController', () => {
    let module: TestingModule;
    let controller: DataPortabilityController;
    let exportModel: Model<ExportDocument>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([{ name: Export.name, schema: ExportSchema }]),
            ],
            controllers: [DataPortabilityController],
            providers: [
                { provide: ExportService, useValue: mockExportService },
                { provide: ImportService, useValue: mockImportService },
                { provide: FilesService, useValue: mockFilesService },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: (_ctx: ExecutionContext) => true })
            .compile();

        controller = module.get(DataPortabilityController);
        exportModel = module.get<Model<ExportDocument>>(getModelToken(Export.name));
    });

    afterAll(() => module.close());

    it('export calls ExportService and returns metadata', async () => {
        const result = await controller.export(authReq as never);
        expect(mockExportService.export).toHaveBeenCalledWith(userId);
        expect(result.exportId).toBe('uuid-1');
        expect(result.files).toHaveLength(1);
    });

    it('downloadFile returns 404 for unknown exportId', async () => {
        const fakeReply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
        await expect(
            controller.downloadFile(authReq as never, 'nonexistent-id', 'export-part-1.json', fakeReply as never),
        ).rejects.toThrow();
    });

    it('downloadFile serves file for owned export', async () => {
        const exportId = 'test-export-' + Date.now();
        await exportModel.create({
            userId: new Types.ObjectId(userId),
            exportId,
            files: [
                {
                    storagePath: `${exportId}/export-part-1.json`,
                    filename: 'export-part-1.json',
                    sizeBytes: 5,
                    contentType: 'application/json',
                    sha256: 'abc',
                },
            ],
        });

        const fileBuffer = Buffer.from('{}');
        mockFilesService.readByPath.mockResolvedValueOnce(fileBuffer);

        const fakeReply = { header: vi.fn().mockReturnThis(), send: vi.fn() };
        await controller.downloadFile(authReq as never, exportId, 'export-part-1.json', fakeReply as never);

        expect(fakeReply.header).toHaveBeenCalledWith(
            'Content-Disposition',
            'attachment; filename="export-part-1.json"',
        );
        expect(fakeReply.send).toHaveBeenCalledWith(fileBuffer);
    });

    describe('import', () => {
        it('defaults onConflict to ignore when the field is absent', async () => {
            await controller.import(importRequest({}) as never);

            expect(mockImportService.import).toHaveBeenCalledWith(expect.objectContaining({ onConflict: 'ignore' }));
        });

        it('passes a supplied onConflict through', async () => {
            await controller.import(importRequest({ onConflict: 'replace' }) as never);

            expect(mockImportService.import).toHaveBeenCalledWith(expect.objectContaining({ onConflict: 'replace' }));
        });

        it('rejects an unrecognised onConflict rather than silently ignoring it', async () => {
            await expect(controller.import(importRequest({ onConflict: 'overwrite' }) as never)).rejects.toThrow(
                ValidationError,
            );
        });

        it('rejects an unrecognised form field', async () => {
            await expect(controller.import(importRequest({ dryRun: 'true' }) as never)).rejects.toThrow(
                ValidationError,
            );
        });
    });
});

/** Builds a request whose multipart stream carries one valid envelope plus the given form fields. */
function importRequest(fields: Record<string, string>): { user: { sub: string }; parts: () => AsyncGenerator } {
    const envelope = {
        version: '1',
        exportedAt: new Date().toISOString(),
        exportId: 'uuid-1',
        part: 1,
        totalParts: 1,
        tasks: [{ source: 'todoist', sourceId: '1' }],
        notifications: [],
    };

    return {
        user: { sub: userId },
        parts: async function* () {
            yield {
                type: 'file',
                filename: 'part-1.json',
                toBuffer: async () => Buffer.from(JSON.stringify(envelope)),
            };

            for (const [fieldname, value] of Object.entries(fields)) {
                yield { type: 'field', fieldname, value };
            }
        },
    };
}
