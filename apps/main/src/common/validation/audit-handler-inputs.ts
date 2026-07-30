import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { UNVALIDATED_INPUT } from './unvalidated-input.decorator.js';

/** A controller class, as stored on the Nest instance wrapper. */
export type ControllerClass = new (...args: never[]) => object;

/**
 * Nest's route-argument metadata: one entry per decorated handler parameter, keyed
 * `"{RouteParamtypes}:{index}"`. A custom param decorator is keyed by its factory instead, so it
 * never appears under a numeric source.
 */
type RouteArgs = Record<string, { index: number; data?: unknown; pipes?: unknown[] }>;

// From @nestjs/common's RouteParamtypes enum. Hardcoded because the enum lives behind a deep
// import path that is not part of the package's public entrypoint.
const SOURCE_NAMES = new Map([
    [3, '@Body'],
    [4, '@Query'],
    [5, '@Param'],
    [6, '@Headers'],
]);

const REPLACEMENTS = new Map([
    [3, 'ValidatedBody'],
    [4, 'ValidatedQuery or ValidatedQueryValue'],
    [5, 'ValidatedParam'],
    [6, 'ValidatedHeader'],
]);

/**
 * Finds handler arguments that reach a handler without runtime validation.
 *
 * Every argument read off the request must carry a validation pipe, which is what the `Validated*`
 * decorators attach. Requiring the pipe rather than inspecting the argument's type is deliberate:
 * a TS type is erased at compile time, so a DTO annotation proves nothing at runtime, and the
 * `import type` that erases the class is invisible in review.
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

            for (const [key, entry] of Object.entries(routeArgs)) {
                const problem = describeProblem({ key, entry });

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
}: {
    key: string;
    entry: { data?: unknown; pipes?: unknown[] };
}): string | undefined {
    const source = Number(key.split(':')[0]);
    const name = SOURCE_NAMES.get(source);

    if (!name) return undefined;

    if ((entry.pipes?.length ?? 0) > 0) return undefined;

    const target = entry.data === undefined ? `${name}()` : `${name}('${String(entry.data)}')`;

    return `${target} has no validation pipe — use ${REPLACEMENTS.get(source) ?? 'a Validated* decorator'}`;
}
