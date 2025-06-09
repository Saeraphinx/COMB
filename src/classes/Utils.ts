import { TextDisplayBuilder, ButtonBuilder, ButtonStyle, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, type MessageActionRowComponentBuilder, ContainerBuilder, GuildMember, User } from 'discord.js';
import { EnvConfig } from './EnvConfig';
import { CustomID } from './Action';

export function generateComponent(options: {
    removingUser: User;
    initiator: User;
    votes: {weight: number, id: string, username: string }[];
    passed: boolean;
    failed: boolean;
    customIds: {
        cancel: CustomID|string;
        vote: CustomID|string;
        removeVote: CustomID|string;
    };
}) {
    let voteString = options.votes.length == 0 ? options.votes.sort((a,b) => a.weight - b.weight).map((user) => {
        return `- **<@${user.id}>** - ${user.weight}`;
    }).join(`\n`) : `No votes yet.`;

    const components = [
        new ContainerBuilder()
            .setAccentColor(14818589)
            .addSectionComponents(
                new SectionBuilder()
                    .setButtonAccessory(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Danger)
                            .setLabel(`Cancel Vote`)
                            .setCustomId(typeof options.customIds.cancel == `string` ? options.customIds.cancel : JSON.stringify(options.customIds.cancel))
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# Emergency Vote`),
                    ),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`<@${options.initiator.id}> (${options.initiator.username}) has begun a vote to remove <@${options.removingUser.id}> (${options.removingUser.username})`),
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(voteString || `No votes yet.`),
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
            )
            .addActionRowComponents(
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Primary)
                            .setLabel(`Vote`)
                            .setCustomId(typeof options.customIds.vote == `string` ? options.customIds.vote : JSON.stringify(options.customIds.vote)),
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel(`Remove Vote`)
                            .setCustomId(typeof options.customIds.removeVote == `string` ? options.customIds.removeVote : JSON.stringify(options.customIds.removeVote)),
                    ),
            ),
    ];
    return components;
}