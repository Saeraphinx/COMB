import { ButtonInteraction, Interaction, MessageFlags, ModalSubmitInteraction } from 'discord.js';
import { Logger } from './Logger';

export function rejectInstigator(interaction: ButtonInteraction | ModalSubmitInteraction, message: string, loggerMessage: string | null = message): void {
    if (loggerMessage !== null) {
        Logger.warn(`${interaction.user.username} (${interaction.user.id}) while using vote: ${loggerMessage}`);
    }
    interaction.reply({
        content: message,
        flags: [MessageFlags.Ephemeral] 
    });
    return;
}

export function checkIfValidInteraction(interaction: ModalSubmitInteraction | ButtonInteraction, type: `modal` | `button`, name: string): boolean {
    if (type === `button` && interaction.isButton()) {
        try {
            let cId = JSON.parse(interaction.customId)
            return cId.t === type && cId.n === name;
        } catch (error) {
            Logger.error(`Error parsing customId for interaction ${interaction.id}: ${error}`);
            return false;
        }
    } else if (type === `modal` && interaction.isModalSubmit()) {
        try {
            let cId = JSON.parse(interaction.customId);
            return cId.t === type && cId.n === name;
        } catch (error) {
            Logger.error(`Error parsing customId for interaction ${interaction.id}: ${error}`);
            return false;
        }
    }
    return false;
}