import { BaseInteraction, ButtonInteraction, InteractionType, ModalSubmitInteraction } from "discord.js";
import { Luma } from "./Luma";

type ActionType = `modal` | `button`

export interface CustomID {
    t: ActionType;
    n: string;
    cD: {
        [key: string]: string | number | boolean;
    }
}

export interface IAction {
    type: ActionType;
    name: string;
    run: (interaction: ModalSubmitInteraction | ButtonInteraction) => Promise<void>;
}

export class Action {
    public type: ActionType;
    public name: string;
    public run: (interaction: ModalSubmitInteraction | ButtonInteraction) => Promise<void>;

    constructor(action: IAction) {
        this.type = action.type;
        this.name = action.name;
        this.run = action.run;
    }

    public static registerListener(luma: Luma): void {
        luma.on("interactionCreate", async (interaction: BaseInteraction) => {
            if (interaction.isButton() || interaction.isModalSubmit()) {
                let customId: CustomID | null = null;
                try {
                    customId = JSON.parse(interaction.customId) as CustomID;
                    if (!customId || !customId.t || !customId.n || !customId.cD) {
                        throw new Error("Invalid customId format");
                    }
                } catch (error) {
                    console.error(`Error parsing customId for interaction ${interaction.id}:`, error);
                    Luma.sendErrorInteractionResponse(interaction);
                    return;
                }

                const action = luma.mActions.get(`${customId.t}-${customId.n}`);
                if (!action) {
                    console.warn(`No action found for customId ${interaction.customId}`);
                    Luma.sendErrorInteractionResponse(interaction, `No action found for this interaction.`);
                    return;
                }

                try {
                    await action.run(interaction);
                } catch (error) {
                    console.error(`Error executing action ${interaction.customId}:`, error);
                    Luma.sendErrorInteractionResponse(interaction, `There was an error while processing this action.`);
                }
            }
        });
    }
}
