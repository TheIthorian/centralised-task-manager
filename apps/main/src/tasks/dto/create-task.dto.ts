import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsISO8601,
    Min,
    Max,
    IsInt,
    MaxLength,
    IsArray,
    ValidateNested,
    IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto, DueDateDto, DurationDto } from './update-task.dto.js';
import type { CreateTaskDto as ICreateTaskDto } from '@ctm/api-client';

export class CreateTaskDto implements ICreateTaskDto {
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

    @ApiPropertyOptional({ type: DueDateDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DueDateDto)
    due?: DueDateDto;

    @ApiPropertyOptional({ example: '2026-06-30' })
    @IsOptional()
    @IsISO8601()
    deadlineDate?: string;

    @ApiPropertyOptional({ type: DurationDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DurationDto)
    duration?: DurationDto;

    @ApiPropertyOptional({ minimum: 1, maximum: 4, example: 2 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(4)
    priority?: 1 | 2 | 3 | 4;

    @ApiPropertyOptional({ type: [LocationDto], description: 'Locations with Google Maps links' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LocationDto)
    locations?: LocationDto[];

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
