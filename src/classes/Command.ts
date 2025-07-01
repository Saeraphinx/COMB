import { AutocompleteInteraction, ChatInputCommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";
import { Luma } from "./Luma.ts";
import { Logger } from "./Logger.ts";

export interface ICommand {
    name: string;
    description: string;
    commandData: RESTPostAPIChatInputApplicationCommandsJSONBody;
    run: (interaction: ChatInputCommandInteraction) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export class Command {
    public name: string;
    public description: string;
    public commandData: RESTPostAPIChatInputApplicationCommandsJSONBody;
    public run: (interaction: ChatInputCommandInteraction) => Promise<void>;
    public autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;

    constructor(command: ICommand) {
        this.name = command.name;
        this.description = command.description;
        this.commandData = command.commandData;
        this.run = command.run;
        this.autocomplete = command.autocomplete;
    }

    public static registerListener(luma: Luma): void {
        Logger.debug(`Registering command listener`);
        luma.on("interactionCreate", async (interaction) => {
            if (interaction.isAutocomplete()) {
                const command = luma.commands.get(interaction.commandName);
                if (!command || !command.autocomplete) return;
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    console.error(`Error executing autocomplete for command ${interaction.commandName}:`, error);
                }
                return;
            } else if (interaction.isChatInputCommand()) {
                const command = luma.commands.get(interaction.commandName);
                if (!command) return;

                try {
                    await command.run(interaction);
                } catch (error) {
                    console.error(`Error executing command ${interaction.commandName}:`, error);
                    await Luma.sendErrorInteractionResponse(interaction, `There was an error while processing this command.`);
                }
            } else {
                return;
            }
        });
    }
}