import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsISO8601, IsInt, Min, Max, IsArray } from 'class-validator';

export class UpdateTaskDto {
    @ApiPropertyOptional({ example: 'Updated title' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({ example: 'Updated description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z' })
    @IsOptional()
    @IsISO8601()
    dueDate?: string;

    @ApiPropertyOptional({ minimum: 1, maximum: 4, example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(4)
    priority?: number;

    @ApiPropertyOptional({ type: [String], example: ['work', 'urgent'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
}
