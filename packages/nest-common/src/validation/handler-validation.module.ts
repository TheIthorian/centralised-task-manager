import { Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { InternalError } from '@ctm/errors';
import { auditHandlerInputs, type ControllerClass } from './audit-handler-inputs.js';

/**
 * Fails application startup when any handler takes an argument nothing validates.
 *
 * The global pipes cannot report this themselves: an erased type reaches them as a bare `Object`
 * and looks indistinguishable from a value they are meant to pass through. Auditing the route
 * metadata once at boot turns a silently unvalidated endpoint into a crash on deploy.
 */
@Injectable()
export class HandlerValidationAudit implements OnApplicationBootstrap {
    constructor(private readonly discovery: DiscoveryService) {}

    /** Runs the audit, throwing with every finding listed. */
    onApplicationBootstrap(): void {
        const controllers = this.discovery
            .getControllers()
            .map((wrapper) => wrapper.metatype)
            .filter((metatype): metatype is ControllerClass => typeof metatype === 'function');

        const findings = auditHandlerInputs({ controllers });

        if (findings.length === 0) return;

        throw new InternalError(
            `${findings.length} handler argument(s) reach a handler unvalidated:\n  ${findings.join('\n  ')}\n` +
                'Validate each one, or mark the handler @UnvalidatedInput(reason) when it validates its own input.',
        );
    }
}

@Module({
    imports: [DiscoveryModule],
    providers: [HandlerValidationAudit],
})
export class HandlerValidationModule {}
