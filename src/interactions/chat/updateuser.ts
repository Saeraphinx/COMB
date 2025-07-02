import { ActionRow, ActionRowBuilder, ApplicationIntegrationType, GuildMemberRoleManager, InteractionContextType, MessageFlags, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { ICommand } from "../../classes/Command.ts";
import { EnvConfig } from "../../classes/EnvConfig.ts";
import { User } from "../../classes/Database.ts";
import { attemptToPullAllUsers, attemptToUpdateUsersInDatabase } from "../../classes/Jobs.ts";

let commandData = new SlashCommandBuilder();
commandData
    .setName("updateusers")
    .setDescription("Updates the database with the latest information.")
    .addSubcommand(subcommand =>
        subcommand.setName("user")
            .setDescription("Updates the database with the latest information for a specific user.")
            .addUserOption(option =>
                option.setName("user")
                    .setDescription("The user to update")
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand.setName("all")
            .setDescription("Updates the database with the latest information for all users in the guild.")
    )
    .addSubcommand(subcommand =>
        subcommand.setName("existing")
            .setDescription("Updates the database with the latest information for all existing users in the database.")
    )
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall);

const command: ICommand = {
    name: commandData.name,
    description: commandData.description,
    commandData: commandData.toJSON(),
    run: async (interaction) => {
        switch (interaction.options.getSubcommand()) {
            case "all":
                interaction.reply({
                    content: "Attempting to pull all users from the guild. This may take a while. The bot will not respond when the process is complete.",
                    flags: [MessageFlags.Ephemeral]
                });
                attemptToPullAllUsers();
                break;
            case "existing":
                interaction.reply({
                    content: "Attempting to update existing users in the database. This may take a while. The bot will not respond when the process is complete.",
                    flags: [MessageFlags.Ephemeral]
                });
                attemptToUpdateUsersInDatabase();
                break;
            case "user":
                let user = interaction.options.getUser("user", false);
                let guild = interaction.guild;
                if (guild === null || guild.id !== EnvConfig.settings.guildId) {
                    interaction.reply({
                        content: "This command can only be used in the configured guild.",
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
                }

                if (user) {
                    guild.members.fetch(user.id).then(async member => {
                        await User.updateUser(member);
                    }).catch(() => {
                        interaction.reply({
                            content: `Could not find user ${user.username} in this guild.`,
                            flags: [MessageFlags.Ephemeral]
                        });
                    });
                }

                guild.members.fetch(interaction.user.id).then(async member => {
                    await User.updateUser(member);
                });
                interaction.reply({
                    content: `User data updated successfully.`,
                    flags: [MessageFlags.Ephemeral]
                });
        }
    }
}
export default command;