import { Controller, Get, Post, Patch, Delete, Put, Param, Body, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { SetFuzzyDeadlineDto } from './dto/set-fuzzy-deadline.dto.js';
import { SetTaskStatusDto } from './dto/set-task-status.dto.js';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';
import type { TaskDocument } from './schemas/task.schema.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import type { TaskDto } from '@ctm/api-client';

type AuthRequest = {
    user: JwtPayload;
};

@ApiTags('Tasks')
@ApiBearerAuth('jwt')
@Controller('tasks')
@UseGuards(CombinedAuthGuard)
export class TasksController {
    constructor(private readonly tasks: TasksService) {}

    /** Map a TaskDocument to the API wire format. */
    private toResponse(t: TaskDocument): TaskDto {
        return {
            id: String(t._id),
            source: t.source,
            sourceId: t.sourceId,
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
            parentId: t.parentId ? String(t.parentId) : null,
            fuzzyDeadline: t.fuzzyDeadline
                ? { type: t.fuzzyDeadline.type, remindEvery: t.fuzzyDeadline.remindEvery }
                : null,
            createdAt: t.createdAt ? t.createdAt.toISOString() : t.syncedAt.toISOString(),
            updatedAt: t.updatedAt ? t.updatedAt.toISOString() : t.syncedAt.toISOString(),
        };
    }

    /** List tasks with optional filters. */
    @ApiOperation({ summary: 'List tasks' })
    @Get()
    async list(@Request() req: AuthRequest, @Query() query: ListTasksQueryDto): Promise<TaskDto[]> {
        const tasks = await this.tasks.list(req.user.sub, query);
        return tasks.map((t) => this.toResponse(t));
    }

    /** Get a single task. */
    @ApiOperation({ summary: 'Get a task by id' })
    @ApiResponse({ status: 404, description: 'Task not found' })
    @Get(':id')
    async findOne(@Request() req: AuthRequest, @Param('id') id: string): Promise<TaskDto> {
        const t = await this.tasks.findOne({ taskId: id, userId: req.user.sub });
        return this.toResponse(t);
    }

    /** Create a task (write-through to source). */
    @ApiOperation({ summary: 'Create a task' })
    @Post()
    async create(@Request() req: AuthRequest, @Body() dto: CreateTaskDto): Promise<TaskDto> {
        const t = await this.tasks.create({ userId: req.user.sub, dto });
        return this.toResponse(t);
    }

    /** Update a task (write-through to source). */
    @ApiOperation({ summary: 'Update a task' })
    @Patch(':id')
    async update(@Request() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateTaskDto): Promise<TaskDto> {
        const t = await this.tasks.update({ taskId: id, userId: req.user.sub, dto });
        return this.toResponse(t);
    }

    /** Set task status (complete or uncomplete). */
    @ApiOperation({ summary: 'Set task status to open or done' })
    @Put(':id/status')
    async setStatus(@Request() req: AuthRequest, @Param('id') id: string, @Body() dto: SetTaskStatusDto): Promise<TaskDto> {
        const t = await this.tasks.setStatus({ taskId: id, userId: req.user.sub, dto });
        return this.toResponse(t);
    }

    /** Set the fuzzy deadline on a task (local-only). */
    @ApiOperation({ summary: 'Set a fuzzy deadline' })
    @Patch(':id/fuzzy-deadline')
    async setFuzzyDeadline(
        @Request() req: AuthRequest,
        @Param('id') id: string,
        @Body() dto: SetFuzzyDeadlineDto,
    ): Promise<TaskDto> {
        const t = await this.tasks.setFuzzyDeadline({ taskId: id, userId: req.user.sub, dto });
        return this.toResponse(t);
    }

    /** Remove the fuzzy deadline from a task. */
    @ApiOperation({ summary: 'Remove a fuzzy deadline' })
    @Delete(':id/fuzzy-deadline')
    async removeFuzzyDeadline(@Request() req: AuthRequest, @Param('id') id: string): Promise<TaskDto> {
        const t = await this.tasks.removeFuzzyDeadline({ taskId: id, userId: req.user.sub });
        return this.toResponse(t);
    }

    /** Delete a task (write-through to source). */
    @ApiOperation({ summary: 'Delete a task' })
    @ApiResponse({ status: 204 })
    @Delete(':id')
    @HttpCode(204)
    async remove(@Request() req: AuthRequest, @Param('id') id: string): Promise<void> {
        await this.tasks.remove({ taskId: id, userId: req.user.sub });
    }
}
