import { Body, Controller, Get, Headers, Param, Post, Query, Request } from '@nestjs/common';
import { IsString } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createZodDto } from '../zod/create-zod-dto.js';
import { objectIdSchema } from '../zod/param-schemas.js';
import { ZodParam } from '../zod/zod-validation.pipe.js';
import { auditHandlerInputs, type ControllerClass } from './audit-handler-inputs.js';
import { UnvalidatedInput } from './unvalidated-input.decorator.js';

type ErasedBody = { name: string };

class ZodBodyDto extends createZodDto({ schema: z.object({ name: z.string().max(10) }), name: 'ZodBodyDto' }) {}

class ClassValidatorBodyDto {
    @IsString()
    name!: string;
}

function audit(controller: ControllerClass): string[] {
    return auditHandlerInputs({ controllers: [controller] });
}

describe('auditHandlerInputs', () => {
    it('accepts a body typed as a Zod DTO', () => {
        @Controller()
        class Ok {
            @Post()
            create(@Body() _body: ZodBodyDto): void {}
        }

        expect(audit(Ok)).toEqual([]);
    });

    it('accepts a body typed as a class-validator DTO', () => {
        @Controller()
        class Ok {
            @Post()
            create(@Body() _body: ClassValidatorBodyDto): void {}
        }

        expect(audit(Ok)).toEqual([]);
    });

    it('flags a body typed as an erased type alias', () => {
        @Controller()
        class Bad {
            @Post()
            create(@Body() _body: ErasedBody): void {}
        }

        expect(audit(Bad)).toEqual([
            'Bad.create: @Body() is typed a plain object type, which is erased at runtime — use a createZodDto class',
        ]);
    });

    it('flags a body typed as Record<string, unknown>', () => {
        @Controller()
        class Bad {
            @Post()
            create(@Body() _body: Record<string, unknown>): void {}
        }

        expect(audit(Bad)).toHaveLength(1);
    });

    it('flags a query object with no DTO', () => {
        @Controller()
        class Bad {
            @Get()
            list(@Query() _query: ErasedBody): void {}
        }

        expect(audit(Bad)[0]).toContain('@Query() is typed a plain object type');
    });

    it('flags a named param with no pipe', () => {
        @Controller()
        class Bad {
            @Get(':id')
            findOne(@Param('id') _id: string): void {}
        }

        expect(audit(Bad)).toEqual(["Bad.findOne: @Param('id') has no validation pipe — wrap a schema with ZodParam"]);
    });

    it('accepts a named param carrying a pipe', () => {
        @Controller()
        class Ok {
            @Get(':id')
            findOne(@Param('id', ZodParam(objectIdSchema)) _id: string): void {}
        }

        expect(audit(Ok)).toEqual([]);
    });

    it('accepts a named query value carrying a pipe', () => {
        @Controller()
        class Ok {
            @Get()
            list(@Query('cursor', ZodParam(z.string().max(64).optional())) _cursor?: string): void {}
        }

        expect(audit(Ok)).toEqual([]);
    });

    it('ignores sources that cannot carry a pipe or a schema', () => {
        @Controller()
        class Ok {
            @Get()
            list(@Request() _req: unknown, @Headers('accept') _accept: string): void {}
        }

        expect(audit(Ok)).toEqual([]);
    });

    it('ignores a handler with no decorated arguments', () => {
        @Controller()
        class Ok {
            @Get()
            list(): void {}
        }

        expect(audit(Ok)).toEqual([]);
    });

    it('skips a handler marked UnvalidatedInput', () => {
        @Controller()
        class Exempt {
            @Post()
            @UnvalidatedInput('validated against a schema compiled at request time')
            create(@Body() _body: Record<string, unknown>): void {}
        }

        expect(audit(Exempt)).toEqual([]);
    });

    it('reports every finding across controllers', () => {
        @Controller()
        class First {
            @Post()
            create(@Body() _body: ErasedBody): void {}
        }

        @Controller()
        class Second {
            @Get(':id')
            findOne(@Param('id') _id: string): void {}
        }

        expect(auditHandlerInputs({ controllers: [First, Second] })).toHaveLength(2);
    });
});
