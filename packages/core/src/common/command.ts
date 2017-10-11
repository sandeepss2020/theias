/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject, named } from "inversify";
import { Disposable, DisposableCollection } from "./disposable";
import { ContributionProvider } from './contribution-provider';

export interface Command {
    id: string;
    label?: string;
    iconClass?: string;
}
export interface CommandHandler {
    execute(...args: any[]): any;
    isEnabled?(...args: any[]): boolean;
    isVisible?(...args: any[]): boolean;
}

export const CommandContribution = Symbol("CommandContribution");

export interface CommandContribution {
    registerCommands(commands: CommandRegistry): void;
}

export const CommandService = Symbol("CommandService");
export interface CommandService {
    /**
     * Reject if a command cannot be executed.
     */
    executeCommand<T>(command: string, ...args: any[]): Promise<T | undefined>;
}

@injectable()
export class CommandRegistry implements CommandService {

    protected readonly _commands: { [id: string]: Command } = {};
    protected readonly _handlers: { [id: string]: CommandHandler[] } = {};

    constructor(
        @inject(ContributionProvider) @named(CommandContribution)
        protected readonly contributionProvider: ContributionProvider<CommandContribution>
    ) { }

    onStart(): void {
        const contributions = this.contributionProvider.getContributions();
        for (const contrib of contributions) {
            contrib.registerCommands(this);
        }
    }

    registerCommand(command: Command, handler?: CommandHandler): Disposable {
        if (handler) {
            const toDispose = new DisposableCollection();
            toDispose.push(this.doRegisterCommand(command));
            toDispose.push(this.registerHandler(command.id, handler));
            return toDispose;
        }
        return this.doRegisterCommand(command);
    }

    protected doRegisterCommand(command: Command): Disposable {
        if (this._commands[command.id]) {
            throw Error(`A command ${command.id} is already registered.`);
        }
        this._commands[command.id] = command;
        return {
            dispose: () => {
                delete this._commands[command.id];
            }
        };
    }

    registerHandler(commandId: string, handler: CommandHandler): Disposable {
        let handlers = this._handlers[commandId];
        if (!handlers) {
            this._handlers[commandId] = handlers = [];
        }
        handlers.push(handler);
        return {
            dispose: () => {
                const idx = handlers.indexOf(handler);
                if (idx >= 0) {
                    handlers.splice(idx, 1);
                }
            }
        };
    }

    isEnabled(command: string, ...args: any[]): boolean {
        return this.getActiveHandler(command, ...args) !== undefined;
    }

    isVisible(command: string, ...args: any[]): boolean {
        return this.getVisibleHandler(command, ...args) !== undefined;
    }

    executeCommand<T>(command: string, ...args: any[]): Promise<T | undefined> {
        const handler = this.getActiveHandler(command, ...args);
        if (handler) {
            return Promise.resolve(handler.execute(...args));
        }
        const argsMessage = args && args.length > 0 ? ` (args: ${JSON.stringify(args)})` : '';
        return Promise.reject(`The command '${command}' cannot be executed. There are no active handlers available for the command.${argsMessage}`);
    }

    getVisibleHandler(commandId: string, ...args: any[]): CommandHandler | undefined {
        const handlers = this._handlers[commandId];
        if (handlers) {
            for (const handler of handlers) {
                if (!handler.isVisible || handler.isVisible(...args)) {
                    return handler;
                }
            }
        }
        return undefined;
    }

    getActiveHandler(commandId: string, ...args: any[]): CommandHandler | undefined {
        const handlers = this._handlers[commandId];
        if (handlers) {
            for (const handler of handlers) {
                if (!handler.isEnabled || handler.isEnabled(...args)) {
                    return handler;
                }
            }
        }
        return undefined;
    }

    get commands(): Command[] {
        const commands: Command[] = [];
        for (const id of this.commandIds) {
            const cmd = this.getCommand(id);
            if (cmd) {
                commands.push(cmd);
            }
        }
        return commands;
    }

    getCommand(id: string): Command | undefined {
        return this._commands[id];
    }

    get commandIds(): string[] {
        return Object.keys(this._commands);
    }
}
