import { Body, Controller, Get, Headers, Param, Post, Query, Request } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createZodDto } from '../zod/create-zod-dto.js';
import { objectIdSchema } from '../zod/param-schemas.js';
import { auditHandlerInputs, type ControllerClass } from './audit-handler-inputs.js';
import { UnvalidatedInput } from './unvalidated-input.decorator.js';
import {
    ValidatedBody,
    ValidatedHeader,
    ValidatedParam,
    ValidatedQuery,
    ValidatedQueryValue,
} from './validated.decorators.js';

class BodyDto extends createZodDto({ schema: z.object({ name: z.string().max(10) }), name: 'BodyDto' }) {}

function audit(controller: ControllerClass): string[] {
    return auditHandlerInputs({ controllers: [controller] });
}

describe('auditHandlerInputs', () => {
    it('accepts every source when read through a Validated decorator', () => {
        @Controller()
        class Ok {
            @Post(':id')
            create(
                @ValidatedBody(BodyDto) _body: BodyDto,
                @ValidatedQuery(BodyDto) _query: BodyDto,
                @ValidatedParam({ name: 'id', schema: objectIdSchema }) _id: string,
                @ValidatedQueryValue({ name: 'cursor', schema: z.string().max(64).optional() }) _cursor?: string,
            ): void {}
        }

        expect(audit(Ok)).toEqual([]);
    });

    it('accepts a validated header', () => {
        @Controller()
        class Ok {
            @Get()
            list(@ValidatedHeader({ name: 'accept', schema: z.string().max(64).default('') }) _accept: string): void {}
        }

        expect(audit(Ok)).toEqual([]);
    });

    it('flags a bare body even when it is typed as a Zod DTO', () => {
        @Controller()
        class Bad {
            @Post()
            create(@Body() _body: BodyDto): void {}
        }

        expect(audit(Bad)).toEqual(['Bad.create: @Body() has no validation pipe — use ValidatedBody']);
    });

    it('flags a bare query object', () => {
        @Controller()
        class Bad {
            @Get()
            list(@Query() _query: BodyDto): void {}
        }

        expect(audit(Bad)[0]).toContain('@Query() has no validation pipe');
    });

    it('flags a named param with no pipe', () => {
        @Controller()
        class Bad {
            @Get(':id')
            findOne(@Param('id') _id: string): void {}
        }

        expect(audit(Bad)).toEqual(["Bad.findOne: @Param('id') has no validation pipe — use ValidatedParam"]);
    });

    it('flags a bare header, which Nest cannot attach a pipe to', () => {
        @Controller()
        class Bad {
            @Get()
            list(@Headers('accept') _accept: string): void {}
        }

        expect(audit(Bad)).toEqual(["Bad.list: @Headers('accept') has no validation pipe — use ValidatedHeader"]);
    });

    it('ignores arguments that carry no request data', () => {
        @Controller()
        class Ok {
            @Get()
            list(@Request() _req: unknown): void {}
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
            create(@Body() _body: BodyDto): void {}
        }

        @Controller()
        class Second {
            @Get(':id')
            findOne(@Param('id') _id: string): void {}
        }

        expect(auditHandlerInputs({ controllers: [First, Second] })).toHaveLength(2);
    });
});
