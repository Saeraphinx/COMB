import { ButtonInteraction, GuildMember, MessageFlags } from "discord.js";
import { IAction } from "src/classes/Action";
import { User } from "src/classes/Database";
import { Logger } from "src/classes/Logger";
import { checkIfValidInteraction, rejectInstigator } from "src/classes/Utils";
import { VoteManager } from "src/classes/VoteManager";

const action: IAction = {
    type: `button`,
    name: "removeVote",
    // accepting an ongoing vote
    run: async (interaction) => {
        if (!checkIfValidInteraction(interaction, `button`, `removeVote`)) {
            return;
        }

        const instigator = interaction.member;
        if (!(instigator instanceof GuildMember)) {
            Logger.error(`interaction memeber isn't guild member.`);
            return rejectInstigator(interaction, "An error occurred while processing your vote. Please try again later.");
        }
        await User.updateUser(instigator);
        if (!VoteManager.instance) {
            Logger.error("VoteManager instance is not initialized.");
            return rejectInstigator(interaction, "There is not an active vote.");
        }

        let voteOutput = VoteManager.instance.removeVote(interaction.user);

        if (voteOutput) {
            await interaction.reply({
                content: `Your vote has been removed.`,
                flags: [MessageFlags.Ephemeral]
            });
        } else {
            Logger.warn(`${instigator.user.username} (${instigator.id}) attempted to remove a vote while no vote is active.`);
            return rejectInstigator(interaction, "There was an error while trying to remove your vote. Please try again later.");
        }
    }
};