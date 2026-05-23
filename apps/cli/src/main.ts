#!/usr/bin/env node
import { Command } from 'commander';
import { registerLoginCommand } from './commands/login.js';
import { registerLogoutCommand } from './commands/logout.js';
import { registerTasksCommand } from './commands/tasks.js';
import { registerConnectorsCommand } from './commands/connectors.js';
import { registerNotificationsCommand } from './commands/notifications.js';

const program = new Command();

program.name('ctm').description('Centralised Task Manager CLI').version('0.0.1');

registerLoginCommand(program);
registerLogoutCommand(program);
registerTasksCommand(program);
registerConnectorsCommand(program);
registerNotificationsCommand(program);

program.parse();
