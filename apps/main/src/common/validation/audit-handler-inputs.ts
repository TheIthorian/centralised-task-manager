import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { getMetadataStorage } from 'class-validator';
import { zodSchemaOf } from '../zod/create-zod-dto.js';
import { UNVALIDATED_INPUT } from './unvalidated-input.decorator.js';

/** A controller class, as stored on the Nest instance wrapper. */
export type ControllerClass = new (...args: never[]) => object;

/**
 * Nest's route-argument metadata: one entry per decorated handler parameter, keyed
 * `"{RouteParamtypes}:{index}"`.
 */
type RouteArgs = Record<string, { index: number; data?: unknown; pipes?: unknown[] }>;

// From @nestjs/common's RouteParamtypes enum. Hardcoded because the enum lives behind a deep
// import path that is not part of the package's public entrypoint.
const BODY = 3;
const QUERY = 4;
const PARAM = 5;

const OBJECT_SOURCES = new Set([BODY, QUERY]);

// `@Headers` is absent by design: Nest's decorator takes no pipes, so there is no way for a
// handler to satisfy the check. Header values are always strings and the adapter bounds their
// size, so treat anything read from one as untrusted text inside the handler.
const NAMED_SOURCES = new Set([QUERY, PARAM]);

const SOURCE_NAMES = new Map([
    [BODY, '@Body'],
    [QUERY, '@Query'],
    [PARAM, '@Param'],
]);

/**
 * Finds handler arguments that reach a handler without runtime validation.
 *
 * A TS type is erased at compile time, so `@Body() dto: SomeType` type-checks while validating
 * nothing: the global pipes see a bare `Object` metatype and pass the value straight through.
 * This audit catches that at startup, when it is a boot failure, rather than on the first
 * malicious request.
 *
 * @returns One human-readable finding per unvalidated argument; empty when everything is covered.
 */
export function auditHandlerInputs({ controllers }: { controllers: ControllerClass[] }): string[] {
    const findings: string[] = [];

    for (const controller of controllers) {
        for (const methodName of handlerNames(controller)) {
            const routeArgs = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, methodName) as RouteArgs | undefined;

            if (!routeArgs) continue;

            if (Reflect.getMetadata(UNVALIDATED_INPUT, controller.prototype[methodName]) !== undefined) continue;

            const paramTypes = (Reflect.getMetadata('design:paramtypes', controller.prototype, methodName) ??
                []) as unknown[];

            for (const [key, entry] of Object.entries(routeArgs)) {
                const problem = describeProblem({ key, entry, metatype: paramTypes[entry.index] });

                if (problem) findings.push(`${controller.name}.${methodName}: ${problem}`);
            }
        }
    }

    return findings;
}

/** Returns the handler method names declared on a controller. */
function handlerNames(controller: ControllerClass): string[] {
    return Object.getOwnPropertyNames(controller.prototype).filter((name) => name !== 'constructor');
}

/** Describes why one route argument is unvalidated, or undefined when it is covered. */
function describeProblem({
    key,
    entry,
    metatype,
}: {
    key: string;
    entry: { data?: unknown; pipes?: unknown[] };
    metatype: unknown;
}): string | undefined {
    // The key is "{source}:{index}"; a custom decorator uses its factory as the source instead.
    const source = Number(key.split(':')[0]);

    if (Number.isNaN(source)) return undefined;

    const name = SOURCE_NAMES.get(source);

    if (!name) return undefined;

    const hasPipe = (entry.pipes?.length ?? 0) > 0;

    if (hasPipe) return undefined;

    // `data` names a single value out of the source, so the argument is a primitive that no
    // DTO schema covers. Only an argument-level pipe can validate it.
    if (entry.data !== undefined && NAMED_SOURCES.has(source)) {
        return `${name}('${String(entry.data)}') has no validation pipe — wrap a schema with ZodParam`;
    }

    if (!OBJECT_SOURCES.has(source)) return undefined;

    if (isValidatedClass(metatype)) return undefined;

    return `${name}() is typed ${describeMetatype(metatype)}, which is erased at runtime — use a createZodDto class`;
}

/** True when a metatype is a class a global pipe can validate against. */
function isValidatedClass(metatype: unknown): boolean {
    if (typeof metatype !== 'function') return false;

    // An erased type alias, interface or `Record<string, unknown>` all surface as Object.
    if (metatype === Object) return false;

    if (zodSchemaOf(metatype)) return true;

    // A class-validator DTO registers metadata against its own constructor.
    return hasClassValidatorMetadata(metatype as ControllerClass);
}

/** True when class-validator holds at least one constraint for a class or its ancestors. */
function hasClassValidatorMetadata(target: ControllerClass): boolean {
    return getMetadataStorage().getTargetValidationMetadatas(target, target.name, false, false).length > 0;
}

/** Names a metatype for a finding message. */
function describeMetatype(metatype: unknown): string {
    if (typeof metatype !== 'function') return 'an unknown type';

    return metatype === Object ? 'a plain object type' : metatype.name;
}
