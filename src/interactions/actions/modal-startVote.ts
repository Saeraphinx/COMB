import { GuildMember, MessageFlags, ModalSubmitInteraction } from "discord.js";
import { CustomID, IAction } from "../../classes/Action.ts";
import { Logger } from "../../classes/Logger.ts";
import { VoteManager } from "../../classes/VoteManager.ts";
import { EnvConfig } from "../../classes/EnvConfig.ts";

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
        let instigator = interaction.member;
        if (!instigator) {
            return rejectInstigator(interaction, "You must be a member of this guild to start a vote.");
        } else if (!(instigator instanceof GuildMember)) {
            let replacementInstigator = await interaction.guild?.members.fetch(instigator.user.id);
            if (!replacementInstigator) {
                return rejectInstigator(interaction, "Could not find your discord account.");
            } else {
                instigator = replacementInstigator;
            }
        }

        if (!voteOnUserId|| typeof voteOnUserId !== "string") {
            return rejectInstigator(interaction, "Invalid user ID provided for voting.");
        }

        const voteOnUser = await interaction.guild?.members.fetch(voteOnUserId);
        if (!voteOnUser) {
            return rejectInstigator(interaction, "The user you are trying to vote on does not exist in this guild.");
        }
        
        const confirmationInput = interaction.fields.getTextInputValue('confirmVote');
        if (confirmationInput.toLowerCase() !== 'yes') {
            return rejectInstigator(interaction, "You must type 'yes' to confirm starting the vote.");
        }

        // start the vote
        if (VoteManager.instance) {
            return rejectInstigator(interaction, "There is already an active vote in progress.");
        }

        try {
            let voteManager = new VoteManager(instigator, voteOnUser);
            interaction.reply({
                content: `Vote started successfully! The vote will last for ${EnvConfig.settings.timeout / 1000} seconds.`,
                flags: [MessageFlags.Ephemeral]
            });
            Logger.info(`Vote started by ${instigator.user.username} (${instigator.id}) on ${voteOnUser.user.username} (${voteOnUser.id}). Vote ID: ${voteManager.voteId}`);
        } catch (error) {
            Logger.error(`Error starting vote: ${error}`);
            return rejectInstigator(interaction, "There was an error while starting the vote. Please try again later.");
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