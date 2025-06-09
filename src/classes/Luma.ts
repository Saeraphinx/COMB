import { Client, ClientOptions, Collection, Interaction, RepliableInteraction } from "discord.js";
import { Command } from "./Command";
import fs from "fs";
import path from "path";
import { Action } from "./Action";
import { VoteManager } from "./VoteManager";

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
        this.loadCommands();
        this.loadActions();
        Command.registerListener(this);
        Action.registerListener(this);
    }

    public static get instance(): Luma {
        if (!Luma._instance) {
            Luma._instance = new Luma({ intents: [] });
        }
        return Luma._instance;
    }

    public loadCommands(): void {
        this.commands = new Collection<string, Command>();
        // load commands from a directory
        const commandsPath = path.join(import.meta.dirname, "../interactions/chat");
        const commandFiles = fs.readdirSync(commandsPath).filter((file: string) => file.endsWith(".ts"));
        for (const file of commandFiles) {
            const commandPath = path.join(commandsPath, file);
            import(commandPath).then((module) => {
                const command: Command = new Command(module.default);
                this.commands.set(command.name, command);
            }).catch((error) => {
                console.error(`Error loading command ${file}:`, error);
            });
        }
    }

    public loadActions(): void {
        this.mActions = new Collection<string, Action>();
        // load actions from a directory
        const actionsPath = path.join(import.meta.dirname, "../interactions/actions");
        const actionFiles = fs.readdirSync(actionsPath).filter((file: string) => file.endsWith(".ts"));
        for (const file of actionFiles) {
            const actionPath = path.join(actionsPath, file);
            import(actionPath).then((module) => {
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
}