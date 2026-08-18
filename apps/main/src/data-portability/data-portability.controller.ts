import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { NotFoundError, ValidationError } from '@ctm/errors';
import { JwtAuthGuard } from '../tokens/jwt-auth.guard.js';
import type { JwtPayload } from '../tokens/token-claims.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Export, type ExportDocument } from '@ctm/db';
import { ExportService } from './export.service.js';
import { ImportService } from './import.service.js';
import { FilesService } from '../files/files.service.js';
import { ExportResponseDto, ImportResponseDto } from './dto/data-portability-response.dto.js';
import { ImportRequestDto, importRequestSchema } from './dto/import-request.dto.js';
import { type ImportEnvelope, importEnvelopeSchema } from './dto/import-envelope.schema.js';
import { parseOrThrow, ValidatedParam } from '@ctm/nest-common';
import { z } from 'zod';

type AuthRequest = FastifyRequest & { user: JwtPayload };

@ApiTags('Data Portability')
@Controller('users/me')
@UseGuards(JwtAuthGuard)
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
        @ValidatedParam({ name: 'exportId', schema: z.string().min(1).max(128) }) exportId: string,
        @ValidatedParam({ name: 'filename', schema: z.string().min(1).max(256) }) filename: string,
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

        void reply.header('Content-Disposition', `attachment; filename="${storedFile.filename}"`);
        void reply.header('Content-Type', storedFile.contentType);
        void reply.send(data);
    }

    /** Import user data from one or more export part files. Accepts multipart/form-data. */
    @ApiOperation({ summary: 'Import user data' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ type: ImportRequestDto })
    @Post('import')
    // The body is a multipart stream this handler drains itself, so there is no argument for
    // ValidatedBody to sit on: the form fields go through importRequestSchema below instead.
    async import(@Req() req: AuthRequest): Promise<ImportResponseDto> {
        const envelopes: ImportEnvelope[] = [];
        const fields: Record<string, unknown> = {};

        const parts = req.parts();

        for await (const part of parts) {
            if (part.type === 'file') {
                const buf = await part.toBuffer();
                let parsed: unknown;
                try {
                    parsed = JSON.parse(buf.toString('utf-8'));
                } catch {
                    throw new ValidationError(`Invalid JSON in uploaded file: ${part.filename ?? 'unknown'}`);
                }

                const envelope = importEnvelopeSchema.safeParse(parsed);

                if (!envelope.success) {
                    throw new ValidationError('Uploaded file is not a valid export envelope');
                }

                envelopes.push(envelope.data);
            } else {
                fields[part.fieldname] = part.value;
            }
        }

        if (envelopes.length === 0) throw new ValidationError('At least one export file is required');

        const { onConflict } = parseOrThrow({ schema: importRequestSchema, value: fields });

        return this.importService.import({ userId: req.user.sub, envelopes, onConflict });
    }
}
