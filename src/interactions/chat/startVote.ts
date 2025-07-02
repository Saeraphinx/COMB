import { ActionRow, ActionRowBuilder, ApplicationIntegrationType, GuildMemberRoleManager, InteractionContextType, MessageFlags, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { ICommand } from "../../classes/Command.ts";
import { EnvConfig } from "../../classes/EnvConfig.ts";

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
    name: commandData.name,
    description: commandData.description,
    commandData: commandData.toJSON(),
    run: async (interaction) => {
        let user = interaction.options.getUser("user", true);
        if (interaction.guild?.id !== EnvConfig.settings.guildId) {
            interaction.reply({
                content: "This command can only be used in the configured guild.",
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }
        let member = await interaction.guild?.members.fetch(user.id).catch(() => null);
        if (!member) {
            interaction.reply({
                content: `Could not find user ${user.username} in this guild.`,
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        if (!member.roles || !(member.roles instanceof GuildMemberRoleManager)) {
            interaction.reply({
                content: `User ${user.username} does not have any roles in this guild.`,
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(JSON.stringify({
                t: "modal",
                n: "startVote",
                cD: {
                    id: user.id,
                    chid: interaction.channelId,
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