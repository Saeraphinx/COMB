import { ButtonInteraction, GuildMember, MessageFlags } from "discord.js";
import { IAction } from "src/classes/Action";
import { User } from "src/classes/Database";
import { Logger } from "src/classes/Logger";

const action: IAction = {
    type: `button`,
    name: "vote",
    run: async (interaction) => {
        if (!interaction.isButton()) {
            console.warn(`Received interaction of type ${interaction.type}, expected ButtonInteraction.`);
            return;
        }

        const customId = JSON.parse(interaction.customId);
        if (customId.t !== "modal" || customId.n !== "startVote") {
            console.warn(`Received interaction with invalid customId: ${interaction.customId}`);
            return;
        }

        const voteOnUserId = customId.cD.id;
        const instigator = interaction.member;
        if (!instigator) {
            return rejectInstigator(interaction, "You must be a member of this guild to start a vote.");
        }
        User.updateUser(instigator);

        if (!voteOnUserId || typeof voteOnUserId !== "string") {
            return rejectInstigator(interaction, "Invalid user ID provided for voting.");
        }

        const voteOnUser = await interaction.guild?.members.fetch(voteOnUserId);
        if (!voteOnUser) {
            return rejectInstigator(interaction, "The user you are trying to vote on does not exist in this guild.");
        }

        // Proceed with starting the vote logic here
    }
};

function rejectInstigator(interaction: ButtonInteraction, message: string, loggerMessage = message): void {
    Logger.warn(`${interaction.user.username} (${interaction.user.id}) while using vote: ${loggerMessage}`);
    interaction.reply({
        content: message,
        flags: [MessageFlags.Ephemeral] 
    });
    return;
}