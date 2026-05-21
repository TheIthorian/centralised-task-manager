import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
    @IsOptional()
    @IsEmail()
    @MaxLength(320)
    email?: string;

    @IsOptional()
    @IsString()
    @MinLength(8)
    @MaxLength(255)
    password?: string;
}
