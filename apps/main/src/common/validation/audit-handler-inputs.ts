import { PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
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

const PARAM_SOURCE = 5;

/** Matches one `:name` token in a route path, ignoring any `?` or `(regex)` suffix. */
const PATH_PARAM_PATTERN = /:([A-Za-z0-9_]+)/g;

/**
 * Finds handler arguments that reach a handler without runtime validation.
 *
 * Every argument read off the request must carry a validation pipe, which is what the `Validated*`
 * decorators attach. Requiring the pipe rather than inspecting the argument's type is deliberate:
 * a TS type is erased at compile time, so a DTO annotation proves nothing at runtime, and the
 * `import type` that erases the class is invisible in review.
 *
 * A path parameter the handler never declares is invisible to that check, so the route path is
 * audited too: the parameter still reaches the application through route matching, it is part of
 * the resource identity, and nothing validates it. It also leaves the operation missing a parameter
 * its path template declares, which is an invalid OpenAPI document.
 *
 * @returns One human-readable finding per unvalidated argument; empty when everything is covered.
 */
export function auditHandlerInputs({ controllers }: { controllers: ControllerClass[] }): string[] {
    const findings: string[] = [];

    for (const controller of controllers) {
        for (const methodName of handlerNames(controller)) {
            if (Reflect.getMetadata(UNVALIDATED_INPUT, controller.prototype[methodName]) !== undefined) continue;

            const routeArgs =
                (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, methodName) as RouteArgs | undefined) ?? {};

            for (const [key, entry] of Object.entries(routeArgs)) {
                const problem = describeProblem({ key, entry });

                if (problem) findings.push(`${controller.name}.${methodName}: ${problem}`);
            }

            for (const name of undeclaredPathParams({ controller, methodName, routeArgs })) {
                findings.push(
                    `${controller.name}.${methodName}: route declares ':${name}' but the handler never reads it, ` +
                        `use ValidatedParam({ name: '${name}', schema })`,
                );
            }
        }
    }

    return findings;
}

/**
 * Returns the method names declared on a controller.
 *
 * Accessors are skipped: reading one off the prototype runs the getter against an undefined `this`.
 */
function handlerNames(controller: ControllerClass): string[] {
    const descriptors = Object.getOwnPropertyDescriptors(controller.prototype);

    return Object.entries(descriptors)
        .filter(([name, descriptor]) => name !== 'constructor' && typeof descriptor.value === 'function')
        .map(([name]) => name);
}

/** Returns the path parameters a handler's route declares but its signature never reads. */
function undeclaredPathParams({
    controller,
    methodName,
    routeArgs,
}: {
    controller: ControllerClass;
    methodName: string;
    routeArgs: RouteArgs;
}): string[] {
    const paramEntries = Object.entries(routeArgs).filter(([key]) => Number(key.split(':')[0]) === PARAM_SOURCE);

    // A bare `@Param()` hands the handler the whole params object, so every parameter is read.
    if (paramEntries.some(([, entry]) => entry.data === undefined)) return [];

    const declared = new Set(paramEntries.map(([, entry]) => String(entry.data)));

    return pathParamNames({ controller, methodName }).filter((name) => !declared.has(name));
}

/** Extracts the `:param` names from a handler's full route path, controller prefix included. */
function pathParamNames({ controller, methodName }: { controller: ControllerClass; methodName: string }): string[] {
    const handler = controller.prototype[methodName] as object;
    const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;

    if (methodPath === undefined) return [];

    const controllerPath = Reflect.getMetadata(PATH_METADATA, controller) as string | string[] | undefined;
    const segments = [...toPaths(controllerPath), ...toPaths(methodPath)];
    const names = new Set<string>();

    for (const segment of segments) {
        for (const match of segment.matchAll(PATH_PARAM_PATTERN)) names.add(match[1]!);
    }

    return [...names];
}

/** Normalises Nest's `string | string[]` path metadata to an array. */
function toPaths(path: string | string[] | undefined): string[] {
    if (path === undefined) return [];

    return Array.isArray(path) ? path : [path];
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
