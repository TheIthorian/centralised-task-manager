import { IsIn, IsOptional } from 'class-validator';

export class SetFuzzyDeadlineDto {
    @IsIn(['this_week', 'this_month', 'someday'])
    type!: 'this_week' | 'this_month' | 'someday';

    @IsOptional()
    @IsIn(['daily', 'weekly'])
    remindEvery?: 'daily' | 'weekly';
}
