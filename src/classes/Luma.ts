import { Client, ClientOptions, Collection, Interaction, RepliableInteraction } from "discord.js";
import { Command } from "./Command.ts";
import fs from "fs";
import path from "path";
import { pathToFileURL } from 'node:url';
import { Action } from "./Action.ts";
import { VoteManager } from "./VoteManager.ts";
import { Logger } from "./Logger.ts";
import { EnvConfig } from "./EnvConfig.ts";
import crypto from "crypto";

const actionsFolderName = "actions";
const commandsFolderName = "chat";
export class Luma extends Client {
    private static _instance: Luma;
    public commands: Collection<string, Command>;
    public mActions: Collection<string, Action>;
    public currentVoteManager: VoteManager | null = null;

    constructor(options: ClientOptions) {
        if (Luma._instance) {
            return Luma._instance;
        }
        super(options);
        Luma._instance = this;
    }

    public static get instance(): Luma {
        if (!Luma._instance) {
            Luma._instance = new Luma({ intents: [] });
        }
        return Luma._instance;
    }

    public async init() {
        await this.loadCommands();
        await this.loadActions();
        Command.registerListener(this);
        Action.registerListener(this);
        this.once("ready", this.registerCommandsWithDiscord);
    }

    private async loadCommands(): Promise<void> {
        this.commands = new Collection<string, Command>();
        // load commands from a directory
        const commandsPath = path.join(import.meta.dirname, "../interactions", commandsFolderName);
        const commandFiles = fs.readdirSync(commandsPath).filter((file: string) => file.endsWith(".js"));
        for (const file of commandFiles) {
            Logger.debug(`Loading command file: ${file}`);
            const commandPath = path.join(commandsPath, file);
            await import(pathToFileURL(commandPath).href).then((module) => {
                const command: Command = new Command(module.default);
                this.commands.set(command.name, command);
            }).catch((error) => {
                console.error(`Error loading command ${file}:`, error);
            });
        }
    }

    private async loadActions(): Promise<void> {
        this.mActions = new Collection<string, Action>();
        // load actions from a directory
        const actionsPath = path.join(import.meta.dirname, "../interactions", actionsFolderName);
        const actionFiles = fs.readdirSync(actionsPath).filter((file: string) => file.endsWith(".js"));
        for (const file of actionFiles) {
            Logger.debug(`Loading action file: ${file}`);
            const actionPath = path.join(actionsPath, file);
            await import(pathToFileURL(actionPath).href).then((module) => {
                const action: Action = new Action(module.default);
                this.mActions.set(`${action.type}-${action.name}`, action);
            }).catch((error) => {
                console.error(`Error loading action ${file}:`, error);
            });
        }
    }

    public static sendErrorInteractionResponse(interaction: RepliableInteraction, errorMessage: string = `There was an error while processing this action`): Promise<any> {
        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: errorMessage, ephemeral: true });
        } else if (!interaction.replied && interaction.deferred) {
            return interaction.editReply({ content: errorMessage });
        } else {
            return interaction.followUp({ content: errorMessage, ephemeral: true });
        }
    }

    public async registerCommandsWithDiscord(): Promise<void> {
        if (!this.application) {
            Logger.error("Application is not available. Cannot register commands.");
            return;
        }
        const localCommands = this.commands.map(command => command.commandData);
        const discordCommands = await this.application.commands.fetch();

        for (const command of localCommands) {
            const existingCommand = discordCommands?.find(c => c.name === command.name);
            if (existingCommand) {
                // Update existing command
                await this.application.commands.edit(existingCommand.id, command);
                Logger.info(`Updated command: ${command.name}`);
            } else {
                // Create new command
                await this.application.commands.create(command);
                Logger.info(`Registered new command: ${command.name}`);
            }
        }
    }
}