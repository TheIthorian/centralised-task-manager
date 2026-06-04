import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsMongoId } from 'class-validator';
import type { TaskRelationDto as ITaskRelationDto, RelationType } from '@ctm/api-client';

const RELATION_TYPES: RelationType[] = ['parent', 'child', 'next', 'previous', 'related'];

/** Request body for adding or removing a relation between two tasks. */
export class TaskRelationDto implements ITaskRelationDto {
    @ApiProperty({ enum: RELATION_TYPES, example: 'parent' })
    @IsIn(RELATION_TYPES)
    type!: RelationType;

    @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'CTM task ObjectId of the related task' })
    @IsMongoId()
    targetTaskId!: string;
}
