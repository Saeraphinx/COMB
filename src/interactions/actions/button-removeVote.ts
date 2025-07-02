import { ButtonInteraction, GuildMember, MessageFlags } from "discord.js";
import { IAction } from "../../classes/Action.ts";
import { User } from "../../classes/Database.ts";
import { Logger } from "../../classes/Logger.ts";
import { checkIfValidInteraction, rejectInstigator } from "../../classes/Utils.ts";
import { VoteManager } from "../../classes/VoteManager.ts";

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
            Logger.log(`${instigator.user.username} (${instigator.id}) does not have a vote to remove.`);
            return rejectInstigator(interaction, "You do not have a vote to remove.");
        }
    }
};

export default action;