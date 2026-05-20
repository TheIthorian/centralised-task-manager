import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsISO8601, Min, Max, IsInt } from 'class-validator';

export class CreateTaskDto {
    @ApiProperty({ example: 'Write quarterly report' })
    @IsString()
    @IsNotEmpty()
    title!: string;

    @ApiPropertyOptional({ example: 'Include Q1 metrics' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
    @IsOptional()
    @IsISO8601()
    dueDate?: string;

    @ApiPropertyOptional({ minimum: 1, maximum: 4, example: 2 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(4)
    priority?: number;

    @ApiProperty({ example: 'todoist', description: 'Connector source to write through to' })
    @IsString()
    @IsNotEmpty()
    source!: string;
}
