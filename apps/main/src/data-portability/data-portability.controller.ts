import { Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { NotFoundError, ValidationError } from '@ctm/errors';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Export, type ExportDocument } from './schemas/export.schema.js';
import { ExportService } from './export.service.js';
import { ImportService } from './import.service.js';
import { FilesService } from '../files/files.service.js';
import type { ExportEnvelopeDto, ExportResponseDto, ImportResponseDto } from '@ctm/api-client';

type AuthRequest = FastifyRequest & { user: JwtPayload };

@ApiTags('Data Portability')
@Controller('users/me')
@UseGuards(CombinedAuthGuard)
export class DataPortabilityController {
    constructor(
        @InjectModel(Export.name) private readonly exportModel: Model<ExportDocument>,
        private readonly exportService: ExportService,
        private readonly importService: ImportService,
        private readonly files: FilesService,
    ) {}

    /** Generate a full data export for the authenticated user. */
    @ApiOperation({ summary: 'Export user data' })
    @Post('export')
    async export(@Req() req: AuthRequest): Promise<ExportResponseDto> {
        return this.exportService.export(req.user.sub);
    }

    /** Download a specific file from a previous export. */
    @ApiOperation({ summary: 'Download an export file' })
    @Get('exports/:exportId/:filename')
    async downloadFile(
        @Req() req: AuthRequest,
        @Param('exportId') exportId: string,
        @Param('filename') filename: string,
        @Res() reply: FastifyReply,
    ): Promise<void> {
        const doc = await this.exportModel.findOne({
            exportId,
            userId: new Types.ObjectId(req.user.sub),
        });

        if (!doc) throw new NotFoundError('Export');

        const storedFile = doc.files.find((f) => f.filename === filename);

        if (!storedFile) throw new NotFoundError('Export file');

        const data = await this.files.readByPath(storedFile.storagePath);

        void reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        void reply.header('Content-Type', storedFile.contentType);
        void reply.send(data);
    }

    /** Import user data from one or more export part files. Accepts multipart/form-data. */
    @ApiOperation({ summary: 'Import user data' })
    @Post('import')
    async import(@Req() req: AuthRequest): Promise<ImportResponseDto> {
        const envelopes: ExportEnvelopeDto[] = [];
        let onConflict: 'replace' | 'ignore' = 'ignore';

        const parts = req.parts();

        for await (const part of parts) {
            if (part.type === 'file') {
                const buf = await part.toBuffer();
                let envelope: ExportEnvelopeDto;
                try {
                    envelope = JSON.parse(buf.toString('utf-8')) as ExportEnvelopeDto;
                } catch {
                    throw new ValidationError(`Invalid JSON in uploaded file: ${part.filename ?? 'unknown'}`);
                }

                if (!isValidEnvelope(envelope)) {
                    throw new ValidationError('Uploaded file is not a valid export envelope');
                }

                envelopes.push(envelope);
            } else if (part.fieldname === 'onConflict') {
                const value = part.value as string;

                if (value === 'replace' || value === 'ignore') onConflict = value;
            }
        }

        if (envelopes.length === 0) throw new ValidationError('At least one export file is required');

        return this.importService.import({ userId: req.user.sub, envelopes, onConflict });
    }
}

function isValidEnvelope(value: unknown): value is ExportEnvelopeDto {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v['version'] === 'string' &&
        typeof v['exportId'] === 'string' &&
        typeof v['part'] === 'number' &&
        typeof v['totalParts'] === 'number' &&
        Array.isArray(v['tasks']) &&
        Array.isArray(v['notifications'])
    );
}
