import { Controller, Get, Post, Patch, Delete, Put, Request, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../tokens/jwt-auth.guard.js';
import { TasksService } from '@ctm/domain';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { SetFuzzyDeadlineDto } from './dto/set-fuzzy-deadline.dto.js';
import { SetTaskStatusDto } from './dto/set-task-status.dto.js';
import { TaskRelationDto } from './dto/task-relation.dto.js';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';
import type { TaskDocument } from '@ctm/db';
import type { JwtPayload } from '../tokens/token-claims.js';
import { AddReminderDto } from './dto/add-reminder.dto.js';
import { TaskDto, ReminderDto } from './dto/task-response.dto.js';
import { OkDto } from '../common/dto/ok.dto.js';
import { objectIdSchema, ValidatedBody, ValidatedParam, ValidatedQuery } from '@ctm/nest-common';
import { z } from 'zod';

type AuthRequest = {
    user: JwtPayload;
};

@ApiTags('Tasks')
@ApiBearerAuth('jwt')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
    constructor(private readonly tasks: TasksService) {}

    /** Map a TaskDocument to the API wire format. */
    private toResponse(t: TaskDocument): TaskDto {
        return {
            id: String(t._id),
            source: t.source,
            sourceId: t.sourceId,
            externalAccountId: t.externalAccountId,
            title: t.title,
            description: t.description,
            completed: t.status === 'done',
            priority: t.priority as 1 | 2 | 3 | 4 | null,
            tags: t.tags,
            locations: t.locations,
            due: t.due
                ? { date: t.due.date.toISOString(), timezone: t.due.timezone, recurrence: t.due.recurrence }
                : null,
            deadlineDate: t.deadlineDate ? t.deadlineDate.toISOString() : null,
            duration: t.duration ?? null,
            relations: t.relations.map((r) => ({ type: r.type, targetTaskId: String(r.targetTaskId) })),
            fuzzyDeadline: t.fuzzyDeadline
                ? { type: t.fuzzyDeadline.type, remindEvery: t.fuzzyDeadline.remindEvery }
                : null,
            reminders: t.reminders.map((r) => ({
                remindAt: r.remindAt.toISOString(),
                firedAt: r.firedAt ? r.firedAt.toISOString() : null,
            })),
            dueDateNotifiedAt: t.dueDateNotifiedAt ? t.dueDateNotifiedAt.toISOString() : null,
            createdAt: t.createdAt ? t.createdAt.toISOString() : t.syncedAt.toISOString(),
            updatedAt: t.updatedAt ? t.updatedAt.toISOString() : t.syncedAt.toISOString(),
        };
    }

    /** List tasks with optional filters. */
    @ApiOperation({ summary: 'List tasks' })
    @Get()
    async list(
        @Request() req: AuthRequest,
        @ValidatedQuery(ListTasksQueryDto) query: ListTasksQueryDto,
    ): Promise<TaskDto[]> {
        const tasks = await this.tasks.list({ userId: req.user.sub, query });
        return tasks.map((t) => this.toResponse(t));
    }

    /** Get a single task. */
    @ApiOperation({ summary: 'Get a task by id' })
    @ApiResponse({ status: 404, description: 'Task not found' })
    @Get(':id')
    async findOne(
        @Request() req: AuthRequest,
        @ValidatedParam({ name: 'id', schema: objectIdSchema }) id: string,
    ): Promise<TaskDto> {
        const t = await this.tasks.findOne({ taskId: id, userId: req.user.sub });
        return this.toResponse(t);
    }

    /** Create a task (write-through to source). */
    @ApiOperation({ summary: 'Create a task' })
    @Post()
    async create(@Request() req: AuthRequest, @ValidatedBody(CreateTaskDto) dto: CreateTaskDto): Promise<TaskDto> {
        const t = await this.tasks.create({ userId: req.user.sub, input: dto });
        return this.toResponse(t);
    }

    /** Update a task (write-through to source). */
    @ApiOperation({ summary: 'Update a task' })
    @Patch(':id')
    async update(
        @Request() req: AuthRequest,
        @ValidatedParam({ name: 'id', schema: objectIdSchema }) id: string,
        @ValidatedBody(UpdateTaskDto) dto: UpdateTaskDto,
    ): Promise<TaskDto> {
        const t = await this.tasks.update({ taskId: id, userId: req.user.sub, input: dto });
        return this.toResponse(t);
    }

    /** Set task status (complete or uncomplete). */
    @ApiOperation({ summary: 'Set task status to open or done' })
    @Put(':id/status')
    async setStatus(
        @Request() req: AuthRequest,
        @ValidatedParam({ name: 'id', schema: objectIdSchema }) id: string,
        @ValidatedBody(SetTaskStatusDto) dto: SetTaskStatusDto,
    ): Promise<TaskDto> {
        const t = await this.tasks.setStatus({ taskId: id, userId: req.user.sub, status: dto.status });
        return this.toResponse(t);
    }

    /** Set the fuzzy deadline on a task (local-only). */
    @ApiOperation({ summary: 'Set a fuzzy deadline' })
    @Patch(':id/fuzzy-deadline')
    async setFuzzyDeadline(
        @Request() req: AuthRequest,
        @ValidatedParam({ name: 'id', schema: objectIdSchema }) id: string,
        @ValidatedBody(SetFuzzyDeadlineDto) dto: SetFuzzyDeadlineDto,
    ): Promise<TaskDto> {
        const t = await this.tasks.setFuzzyDeadline({ taskId: id, userId: req.user.sub, fuzzy: dto });
        return this.toResponse(t);
    }

    /** Remove the fuzzy deadline from a task. */
    @ApiOperation({ summary: 'Remove a fuzzy deadline' })
    @Delete(':id/fuzzy-deadline')
    async removeFuzzyDeadline(
        @Request() req: AuthRequest,
        @ValidatedParam({ name: 'id', schema: objectIdSchema }) id: string,
    ): Promise<TaskDto> {
        const t = await this.tasks.removeFuzzyDeadline({ taskId: id, userId: req.user.sub });
        return this.toResponse(t);
    }

    /** Add a typed relation between two tasks (auto-mirrors the inverse). */
    @ApiOperation({ summary: 'Add a relation between two tasks' })
    @Post(':id/relations')
    async addRelation(
        @Request() req: AuthRequest,
        @ValidatedParam({ name: 'id', schema: objectIdSchema }) id: string,
        @ValidatedBody(TaskRelationDto) dto: TaskRelationDto,
    ): Promise<TaskDto> {
        const t = await this.tasks.addRelation({
            userId: req.user.sub,
            taskId: id,
            type: dto.type,
            targetTaskId: dto.targetTaskId,
        });

        return this.toResponse(t);
    }

    /** Remove a typed relation between two tasks (clears the inverse too). */
    @ApiOperation({ summary: 'Remove a relation between two tasks' })
    @Delete(':id/relations')
    async removeRelation(
        @Request() req: AuthRequest,
        @ValidatedParam({ name: 'id', schema: objectIdSchema }) id: string,
        @ValidatedBody(TaskRelationDto) dto: TaskRelationDto,
    ): Promise<TaskDto> {
        const t = await this.tasks.removeRelation({
            userId: req.user.sub,
            taskId: id,
            type: dto.type,
            targetTaskId: dto.targetTaskId,
        });

        return this.toResponse(t);
    }

    /** Add a reminder datetime to a task. */
    @ApiOperation({ summary: 'Add a reminder to a task' })
    @Post(':id/reminders')
    async addReminder(
        @Request() req: AuthRequest,
        @ValidatedParam({ name: 'id', schema: objectIdSchema }) id: string,
        @ValidatedBody(AddReminderDto) dto: AddReminderDto,
    ): Promise<ReminderDto> {
        return this.tasks.addReminder({ taskId: id, userId: req.user.sub, remindAt: dto.remindAt });
    }

    /** Remove a reminder from a task by index. */
    @ApiOperation({ summary: 'Remove a reminder from a task' })
    @ApiResponse({ status: 200, type: OkDto })
    @Delete(':id/reminders/:index')
    async removeReminder(
        @Request() req: AuthRequest,
        @ValidatedParam({ name: 'id', schema: objectIdSchema }) id: string,
        @ValidatedParam({ name: 'index', schema: z.coerce.number().int().min(0) }) index: number,
    ): Promise<OkDto> {
        await this.tasks.removeReminder({ taskId: id, userId: req.user.sub, index });
        return { ok: true };
    }

    /** Delete a task (write-through to source). */
    @ApiOperation({ summary: 'Delete a task' })
    @ApiResponse({ status: 204 })
    @Delete(':id')
    @HttpCode(204)
    async remove(
        @Request() req: AuthRequest,
        @ValidatedParam({ name: 'id', schema: objectIdSchema }) id: string,
    ): Promise<void> {
        await this.tasks.remove({ taskId: id, userId: req.user.sub });
    }
}
