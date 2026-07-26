import { resolve } from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';
import { createGenerator } from 'ts-json-schema-generator';
import type { OpenAPIObject } from '@nestjs/swagger';

// Minimal structural view of the parts of the spec this script touches. @nestjs/swagger's own
// OpenAPI interfaces are not reachable through its package exports.
type SchemaLike = { $ref?: string } & Record<string, unknown>;
type ResponseLike = { description?: string; content?: Record<string, { schema: SchemaLike }> };
type OperationLike = { operationId?: string; responses?: Record<string, ResponseLike> };
type DocumentLike = {
    paths: Record<string, Record<string, OperationLike>>;
    components?: { schemas?: Record<string, SchemaLike> };
};

type JsonSchemaMap = Record<string, SchemaLike>;

type ReturnTypeInfo = {
    /** Bare type name, e.g. `TaskDto` for `Promise<TaskDto[]>`. */
    name: string;
    isArray: boolean;
};

// Resolved from the cwd the generate-openapi script runs in (apps/main), so the paths hold
// whether it runs from source or from the compiled dist-scripts output.
const APP_ROOT = process.cwd();
const API_CLIENT_TYPES = resolve(APP_ROOT, '../../packages/api-client/src/types.ts');
const API_CLIENT_TSCONFIG = resolve(APP_ROOT, '../../packages/api-client/tsconfig.json');
const CONTROLLERS_GLOB = resolve(APP_ROOT, 'src/**/*.controller.ts');
const MAIN_TSCONFIG = resolve(APP_ROOT, 'tsconfig.json');

/**
 * Build JSON Schema definitions for every exported type in the api-client, keyed by type name.
 * Refs are rewritten from JSON Schema's `#/definitions/…` to OpenAPI's `#/components/schemas/…`.
 */
function buildApiClientSchemas(): JsonSchemaMap {
    const schema = createGenerator({
        path: API_CLIENT_TYPES,
        tsconfig: API_CLIENT_TSCONFIG,
        type: '*',
        expose: 'all',
        topRef: true,
        skipTypeCheck: true,
    }).createSchema('*');

    const definitions = (schema.definitions ?? {}) as JsonSchemaMap;
    const rewritten = JSON.stringify(definitions).replaceAll('#/definitions/', '#/components/schemas/');

    return JSON.parse(inlineStructuralRefs({ json: rewritten, definitions })) as JsonSchemaMap;
}

/**
 * Inline refs to structurally-named definitions (`Record<string,unknown>`, `Omit<A,"b">`, …).
 * Their names are not usable as OpenAPI schema keys — the generator percent-encodes them and
 * the docs renderer then fails to resolve the pointer.
 */
function inlineStructuralRefs({ json, definitions }: { json: string; definitions: JsonSchemaMap }): string {
    const structuralRef = /\{"\$ref":"#\/components\/schemas\/([^"]*(?:%3C|%3E)[^"]*)"\}/g;

    let current = json;

    // Inlining can expose further structural refs nested inside the definition just spliced in.
    for (let pass = 0; pass < 10; pass += 1) {
        const next = current.replace(structuralRef, (match, encoded: string) => {
            const definition = definitions[decodeURIComponent(encoded)];

            return definition ? JSON.stringify(definition) : match;
        });

        if (next === current) break;

        current = next;
    }

    return current;
}

/** Strip `Promise<…>` and a trailing `[]` off a declared return type. */
function parseReturnType(text: string): ReturnTypeInfo | null {
    const unwrapped = text.replace(/^Promise<(.*)>$/s, '$1').trim();
    const isArray = unwrapped.endsWith('[]');
    const name = (isArray ? unwrapped.slice(0, -2) : unwrapped).trim();

    // Only named types map to a schema — `void`, `object` and inline shapes are left alone.
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(name)) return null;

    return { name, isArray };
}

/**
 * Map each Swagger operationId (`<ControllerClass>_<method>`) to the type its handler returns.
 */
function collectReturnTypes(): Map<string, ReturnTypeInfo> {
    const project = new Project({ tsConfigFilePath: MAIN_TSCONFIG });
    project.addSourceFilesAtPaths(CONTROLLERS_GLOB);

    const byOperationId = new Map<string, ReturnTypeInfo>();

    for (const file of project.getSourceFiles(CONTROLLERS_GLOB)) {
        // Controllers often alias api-client types on import (`TokenPair as TokenPairDto`);
        // schemas are keyed by the exported name, so map local names back to it.
        const aliases = new Map<string, string>();

        for (const importDecl of file.getImportDeclarations()) {
            if (importDecl.getModuleSpecifierValue() !== '@ctm/api-client') continue;

            for (const named of importDecl.getNamedImports()) {
                aliases.set(named.getAliasNode()?.getText() ?? named.getName(), named.getName());
            }
        }

        for (const cls of file.getClasses()) {
            const className = cls.getName();
            if (!className) continue;

            for (const method of cls.getMethods()) {
                if (!method.hasModifier(SyntaxKind.PublicKeyword) && method.getScope() !== 'public') continue;

                const returnTypeNode = method.getReturnTypeNode();
                if (!returnTypeNode) continue;

                const parsed = parseReturnType(returnTypeNode.getText());
                if (!parsed) continue;

                byOperationId.set(`${className}_${method.getName()}`, {
                    ...parsed,
                    name: aliases.get(parsed.name) ?? parsed.name,
                });
            }
        }
    }

    return byOperationId;
}

/** Pick the operation's success status code to hang the response schema off. */
function successStatus(codes: string[]): string | null {
    const twoXx = codes.filter((c) => /^2\d\d$/.test(c)).sort();

    return twoXx[0] ?? null;
}

/**
 * Attach JSON response schemas to every operation in the document, derived from the controller
 * handlers' declared return types. Mutates and returns the document.
 *
 * Swagger cannot infer these itself: response types are api-client `type` aliases, which are
 * erased at runtime, so the decorator metadata Nest reads is empty.
 */
export function attachResponseSchemas({ document }: { document: OpenAPIObject }): OpenAPIObject {
    const apiClientSchemas = buildApiClientSchemas();
    const returnTypes = collectReturnTypes();

    const doc = document as unknown as DocumentLike;
    const components = (doc.components ??= {});
    const schemas = (components.schemas ??= {});

    const referenced = new Set<string>();

    for (const pathItem of Object.values(doc.paths)) {
        for (const operation of Object.values(pathItem)) {
            const operationId = operation.operationId;
            if (!operationId || !operation.responses) continue;

            const returnType = returnTypes.get(operationId);
            if (!returnType || !(returnType.name in apiClientSchemas)) continue;

            const status = successStatus(Object.keys(operation.responses));
            if (!status) continue;

            const response = operation.responses[status];
            if (!response || response.content) continue;

            const ref: SchemaLike = { $ref: `#/components/schemas/${returnType.name}` };

            response.content = {
                'application/json': {
                    schema: returnType.isArray ? { type: 'array', items: ref } : ref,
                },
            };

            referenced.add(returnType.name);
        }
    }

    // Pull in the referenced schemas plus everything they transitively $ref.
    const queue = [...referenced];

    while (queue.length > 0) {
        const name = queue.shift();
        if (!name) continue;

        const schema = apiClientSchemas[name];
        if (!schema) continue;

        // A Nest DTO class may already own this name; its schema wins so request bodies keep
        // their class-validator metadata.
        if (!(name in schemas)) schemas[name] = schema;

        for (const [, ref] of JSON.stringify(schema).matchAll(/"#\/components\/schemas\/([^"]+)"/g)) {
            if (ref && !(ref in schemas) && !queue.includes(ref)) queue.push(ref);
        }
    }

    return document;
}
