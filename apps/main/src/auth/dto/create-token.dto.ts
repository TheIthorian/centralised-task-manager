import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateTokenDto {
    @ApiProperty({ example: 'my-cli', description: 'Human-readable label for the token' })
    @IsString()
    @MinLength(1)
    label!: string;
}
