import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, GuildMember, Message, MessageActionRowComponentBuilder, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, User } from "discord.js";
import { EnvConfig } from "./EnvConfig";
import { generateComponent } from "./Utils";
import { create } from "domain";
import { DatabaseManager } from "./Database";
import { Op } from "sequelize";
import { Logger } from "./Logger.ts";

export class VoteManager {
    private static _instance: VoteManager | null = null;
    public instigator: GuildMember;
    public target: GuildMember;
    public votes: Map<string, number>; // Map of user IDs to their vote data
    public message: Message; // Message to update with vote results
    public expiry: Date; // Expiry date for the vote
    public pingString: string; // String to ping the instigator and target in the vote message

    static get instance(): VoteManager {
        if (!VoteManager._instance) {
            throw new Error("VoteManager instance does not exist. Use the constructor to create a new instance.");
        }
        return VoteManager._instance;
    }

    constructor(instigator: GuildMember, target: GuildMember) {
        if (VoteManager._instance) {
            throw new Error("VoteManager instance already exists. Use getInstance() instead.");
        }
        this.instigator = instigator;
        this.target = target;
        this.votes = new Map<string, number>();
        this.expiry = new Date(Date.now() + EnvConfig.settings.timeout); // Set expiry based on configuration
    }

    public update(): { passed: boolean, failed: boolean } {
        let totalWeightedVotes = 0;
        for (const [userId, weight] of this.votes.entries()) {
            totalWeightedVotes += weight;
        }

        if (totalWeightedVotes >= EnvConfig.settings.requiredVotes) {
            // Logic to handle when the vote passes
            this.message?.edit({ content: `Vote passed with ${totalWeightedVotes} weighted votes.`, components: [] });
            return {passed: true, failed: false}; // Vote passed
        }

        if (Date.now() > this.expiry.getTime()) {
            // Logic to handle when the vote fails due to timeout
            this.message?.edit({ content: `Vote failed due to timeout.`, components: [] });
            return {passed: false, failed:true}; // Vote failed
        }

        return {passed: false, failed: false}; // Vote still ongoing
    }

    public addVote(user: User): boolean {
        if (this.votes.has(user.id)) {
            return false; // User has already voted
        } else {
            for (const roleWeight of EnvConfig.settings.roleWeights) {
                if (this.instigator.roles.cache.has(roleWeight.roleId)) {
                    this.votes.set(user.id, roleWeight.weight);
                    return true; // Vote added successfully
                }
            }
            return false; // Role not found, vote not added
        }
    }

    public removeVote(user: User): boolean {
        if (this.votes.has(user.id)) {
            this.votes.delete(user.id);
            return true; // Vote removed successfully
        }
        return false; // User has not voted
    }

    private generateMessage(passed: boolean, failed: boolean) {
        let pingString;
        DatabaseManager.instance.Users.findAll({
            where: {
                userId: { [Op.ne]: this.instigator.id }
            }}
        ).then(users => {
            pingString = users.map(user => `<@${user.userId}>`).join(``);
        }).catch(error => {
            Logger.error(`Failed to fetch users for ping string: ${error.message}`);
            pingString = `<@${this.instigator.id}>`; // Fallback to instigator if fetching fails
        });

        let voteString = this.votes.size === 0 ? `No votes yet.` : Array.from(this.votes.entries())
            .sort((a, b) => a[1] - b[1])
            .map(([userId, weight]) => `- **<@${userId}>** - ${weight}`)
            .join(`\n`);

        // change this to use the built in colors
        let color = 14818589; // Default color for the vote message
        if (passed) {
            color = 3066993; // Green color for passed votes
        } else if (failed) {
            color = 15105570; // Red color for failed votes
        }

        let mainMessage = `<@${this.instigator.id}> (${this.instigator.user.username}) has begun a vote to remove <@${this.target.id}> (${this.target.user.username})`;
        if (passed) {
            mainMessage += `\n\nThe vote has passed with ${this.votes.size} votes.`;
        } else if (failed) {
            mainMessage += `\n\nThe vote has failed.`;
        }

        const components = [
            new ContainerBuilder()
                .setAccentColor(color)
                .addSectionComponents(
                    new SectionBuilder()
                        .setButtonAccessory(
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Danger)
                                .setLabel(`Cancel Vote`)
                                .setCustomId(JSON.stringify({
                                    t: "button",
                                    n: "cancelVote",
                                    cD: {
                                        id: this.target.id,
                                        initiatorId: this.instigator.id,
                                    }
                                })
                            )
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`# Emergency Vote`),
                        ),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`<@${this.instigator.id}> (${this.instigator.user.username}) has begun a vote to remove <@${this.target.id}> (${this.instigator.user.username})`),
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
                                .setCustomId(JSON.stringify({
                                    t: "button",
                                    n: "vote",
                                    cD: {
                                        id: this.target.id,
                                        initiatorId: this.instigator.id,
                                    }}
                                )),
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Secondary)
                                .setLabel(`Remove Vote`)
                                .setCustomId(JSON.stringify({
                                    t: "button",
                                    n: "removeVote",
                                    cD: {
                                        id: this.target.id,
                                        initiatorId: this.instigator.id,
                                    }
                                })),
                        ),
                ),
        ];
        return components;
    }
}