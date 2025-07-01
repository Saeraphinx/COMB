import { MessageFlags, ModalSubmitInteraction } from "discord.js";
import { CustomID, IAction } from "../../classes/Action.ts";
import { Logger } from "../../classes/Logger.ts";

const action: IAction = {
    type: "modal",
    name: "startVote",
    run: async (interaction) => {
        if (!interaction.isModalSubmit()) {
            console.warn(`Received interaction of type ${interaction.type}, expected ModalSubmitInteraction.`);
            return;
        }
        const customId = JSON.parse(interaction.customId) as CustomID; // already validated in Action.ts
        const voteOnUserId = customId.cD.id;
        const instigator = interaction.member;
        if (!instigator) {
            return rejectInstigator(interaction, "You must be a member of this guild to start a vote.");
        }

        if (!voteOnUserId|| typeof voteOnUserId !== "string") {
            return rejectInstigator(interaction, "Invalid user ID provided for voting.");
        }

        const voteOnUser = interaction.guild?.members.fetch(voteOnUserId);
        if (!voteOnUser) {
            return rejectInstigator(interaction, "The user you are trying to vote on does not exist in this guild.");
        }
        
        const confirmationInput = interaction.fields.getTextInputValue('unused');
        if (confirmationInput.toLowerCase() !== 'yes') {
            return rejectInstigator(interaction, "You must type 'yes' to confirm starting the vote.");
        }

        
    }
}

function rejectInstigator(interaction: ModalSubmitInteraction, message: string, loggerMessage = message): void {
    Logger.warn(`${interaction.user.username} (${interaction.user.id}) while using startVote: ${loggerMessage}`);
    interaction.reply({
        content: message,
        flags: [MessageFlags.Ephemeral] 
    });
    return;
}

export default action;