import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { SetFuzzyDeadlineDto } from './dto/set-fuzzy-deadline.dto.js';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

interface AuthRequest {
    user: JwtPayload;
}

@ApiTags('Tasks')
@ApiBearerAuth('jwt')
@Controller('tasks')
@UseGuards(CombinedAuthGuard)
export class TasksController {
    constructor(private readonly tasks: TasksService) {}

    /** List tasks with optional filters (status, source, fuzzy, surfaced, page, limit). */
    @ApiOperation({ summary: 'List tasks', description: 'Returns aggregated tasks across all connected sources.' })
    @Get()
    async list(@Request() req: AuthRequest, @Query() query: ListTasksQueryDto): Promise<unknown[]> {
        const tasks = await this.tasks.list(req.user.sub, query);

        return tasks.map((t) => ({
            id: String(t._id),
            source: t.source,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            tags: t.tags,
            sourceDueDate: t.sourceDueDate,
            fuzzyDeadline: t.fuzzyDeadline,
        }));
    }

    /** Get a single task. */
    @ApiOperation({ summary: 'Get a task by id' })
    @ApiResponse({ status: 404, description: 'Task not found' })
    @Get(':id')
    async findOne(@Request() req: AuthRequest, @Param('id') id: string): Promise<unknown> {
        const t = await this.tasks.findOne({ taskId: id, userId: req.user.sub });

        return {
            id: String(t._id),
            source: t.source,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            tags: t.tags,
            sourceDueDate: t.sourceDueDate,
            fuzzyDeadline: t.fuzzyDeadline,
        };
    }

    /** Create a task (write-through to source). */
    @ApiOperation({
        summary: 'Create a task',
        description: 'Creates the task in CTM and writes it through to the specified connector source.',
    })
    @Post()
    async create(@Request() req: AuthRequest, @Body() dto: CreateTaskDto): Promise<unknown> {
        const t = await this.tasks.create({ userId: req.user.sub, dto });

        return { id: String(t._id), source: t.source, title: t.title, status: t.status };
    }

    /** Update a task (write-through to source). */
    @ApiOperation({ summary: 'Update a task' })
    @Patch(':id')
    async update(@Request() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateTaskDto): Promise<unknown> {
        const t = await this.tasks.update({ taskId: id, userId: req.user.sub, dto });

        return { id: String(t._id), title: t.title, status: t.status };
    }

    /** Mark a task as complete (write-through to source). */
    @ApiOperation({ summary: 'Complete a task' })
    @Post(':id/complete')
    async complete(@Request() req: AuthRequest, @Param('id') id: string): Promise<unknown> {
        const t = await this.tasks.complete({ taskId: id, userId: req.user.sub });

        return { id: String(t._id), status: t.status };
    }

    /** Set the fuzzy deadline on a task (local-only). */
    @ApiOperation({
        summary: 'Set a fuzzy deadline',
        description: 'Stores a fuzzy deadline locally. Never written back to the source.',
    })
    @Patch(':id/fuzzy-deadline')
    async setFuzzyDeadline(
        @Request() req: AuthRequest,
        @Param('id') id: string,
        @Body() dto: SetFuzzyDeadlineDto,
    ): Promise<unknown> {
        const t = await this.tasks.setFuzzyDeadline({ taskId: id, userId: req.user.sub, dto });

        return { id: String(t._id), fuzzyDeadline: t.fuzzyDeadline };
    }

    /** Remove the fuzzy deadline from a task. */
    @ApiOperation({ summary: 'Remove a fuzzy deadline' })
    @Delete(':id/fuzzy-deadline')
    async removeFuzzyDeadline(@Request() req: AuthRequest, @Param('id') id: string): Promise<unknown> {
        const t = await this.tasks.removeFuzzyDeadline({ taskId: id, userId: req.user.sub });

        return { id: String(t._id), fuzzyDeadline: t.fuzzyDeadline };
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
