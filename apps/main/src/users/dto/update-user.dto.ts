import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { UpdateUserDto as IUpdateUserDto } from '@ctm/api-client';

export class UpdateUserDto implements IUpdateUserDto {
    @IsOptional()
    @IsEmail()
    @MaxLength(320)
    email?: string;

    @IsOptional()
    @IsString()
    @MinLength(8)
    @MaxLength(255)
    currentPassword?: string;

    @IsOptional()
    @IsString()
    @MinLength(8)
    @MaxLength(255)
    newPassword?: string;
}
