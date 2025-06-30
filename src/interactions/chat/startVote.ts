import { ActionRow, ActionRowBuilder, ApplicationIntegrationType, InteractionContextType, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { ICommand } from "../../classes/Command.ts";

let commandData = new SlashCommandBuilder();
commandData
    .setName("startvote")
    .setDescription("Starts a vote for a given topic.")
    .addUserOption(option =>
        option.setName("user")
            .setDescription("The user to vote for")
            .setRequired(true)
        )
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall);

const command: ICommand = {
    name: "startVote",
    description: "Starts a vote for a given topic.",
    commandData: commandData.toJSON(),
    run: async (interaction) => {
        let user = interaction.options.getUser("user", true);

        const modal = new ModalBuilder()
            .setCustomId(JSON.stringify({
                t: "modal",
                n: "startVote",
                cD: {
                    id: user.id,
                }
            }))
            .setTitle('Start Vote')
        
        const textBox = new TextInputBuilder()
            .setCustomId('confirmVote')
            .setLabel("Are you sure you want to start a vote?")
            .setPlaceholder("Type 'yes' to confirm.")
            .setRequired(true)
            .setMinLength(3)
            .setStyle(TextInputStyle.Short);

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(textBox);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    }
    
}
export default command;