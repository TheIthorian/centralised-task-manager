import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RefreshDto {
    @ApiProperty({ description: 'Refresh token issued by POST /auth/login or /auth/register', maxLength: 4096 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(4096)
    refreshToken!: string;
}
