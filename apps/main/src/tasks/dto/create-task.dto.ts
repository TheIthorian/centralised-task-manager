import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsISO8601, Min, Max, IsInt, MaxLength } from 'class-validator';

export class CreateTaskDto {
    @ApiProperty({ example: 'Write quarterly report', maxLength: 200 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title!: string;

    @ApiPropertyOptional({ example: 'Include Q1 metrics', maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
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

    @ApiProperty({
        example: 'todoist',
        description: 'Connector source to write through to',
        maxLength: 50,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    source!: string;
}
