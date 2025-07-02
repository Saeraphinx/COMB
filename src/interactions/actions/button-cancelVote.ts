import { ButtonInteraction, GuildMember, MessageFlags } from "discord.js";
import { IAction } from "../../classes/Action.ts";
import { User } from "../../classes/Database.ts";
import { Logger } from "../../classes/Logger.ts";
import { checkIfValidInteraction, rejectInstigator } from "../../classes/Utils.ts";
import { VoteManager } from "../../classes/VoteManager.ts";

const action: IAction = {
    type: `button`,
    name: "cancelVote",
    // accepting an ongoing vote
    run: async (interaction) => {
        if (!checkIfValidInteraction(interaction, `button`, `cancelVote`)) {
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

        if (interaction.user.id === VoteManager.instance.instigator.id) {
            await VoteManager.instance.cancelVote();
            await interaction.reply({
                content: `The vote has been cancelled.`,
                flags: [MessageFlags.Ephemeral]
            });
        } else {
            Logger.warn(`User ${interaction.user.username} (${interaction.user.id}) attempted to cancel a vote they are not the instigator of.`);
            return rejectInstigator(interaction, "You are not the instigator of this vote and cannot cancel it.");
        }
    }
};

export default action;