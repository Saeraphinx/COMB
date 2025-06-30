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
        if (!checkIfValidInteraction(interaction, `button`, `acceptVote`)) {
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

        let voteOutput = VoteManager.instance.addVote(instigator);

        switch (voteOutput) {
            case "voteAdded":
                await interaction.reply({
                    content: `Your vote has been processed.`,
                    flags: [MessageFlags.Ephemeral]
                });
                break;
            case "alreadyVoted":
                return rejectInstigator(interaction, "You have already voted in this vote.");
            case "ineligble":
                Logger.warn(`${instigator.user.username} (${instigator.id}) attempted to vote while no vote is active.`);
                return rejectInstigator(interaction, "There is no active vote at the moment.");
            default:
                Logger.error(`Unexpected vote output: ${voteOutput}`);
                return rejectInstigator(interaction, "An unexpected error occurred while processing your vote.");
                
        }
    }
};