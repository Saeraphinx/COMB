import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable, Colors, ContainerBuilder, GuildMember, Message, MessageActionRowComponentBuilder, MessageCreateOptions, MessageFlags, MessagePayload, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, User } from "discord.js";
import { EnvConfig } from "./EnvConfig.ts";
import { create } from "domain";
import { DatabaseManager } from "./Database.ts";
import { Op } from "sequelize";
import { Logger } from "./Logger.ts";
import crypto from "node:crypto";
import { Luma } from "./Luma.ts";
import { stat } from "node:fs";
import ms from "ms";

export class VoteManager {
    private static _instance: VoteManager | null = null;
    public instigator: GuildMember;
    public target: GuildMember;
    public rolesStrings: string[]; // Roles to remove from the target if the vote passes. Not to be used when removing roles.
    public votes: Map<string, number>; // Map of user IDs to their vote data
    public message: Message | null; // Message to update with vote results
    public expiry: Date; // Expiry date for the vote
    public pingString: string; // String to ping the instigator and target in the vote message
    public pingIds: string[]; // Array of user IDs to ping in the vote message
    private _voteId: string; // Unique identifier for the vote
    private _updateInterval: NodeJS.Timeout | null = null; // Interval for updating the vote status

    get voteId(): string {
        return this._voteId;
    }

    static get instance(): VoteManager | null {
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
        this._voteId = crypto.randomBytes(8).toString("base64url");
        this.rolesStrings = target.roles.cache.filter(role => !role.managed && role.name !== `@everyone`).map(role => `${role.name} (${role.id})`);
        this.pingString = `Unset`;
        this.pingIds = [this.instigator.id]; // Ping instigator and target by default
        this.message = null;
        this.sendMessage();
        VoteManager._instance = this; // Set the static instance to the current instance
        this._updateInterval = setInterval(() => {
            this.update().catch(error => {
                Logger.error(`Failed to update vote: ${error.message}`);
            });
        }, ms(`1 minute`));
    }

    get voteScore(): number {
        let totalWeightedVotes = 0;
        for (const [userId, weight] of this.votes.entries()) {
            totalWeightedVotes += weight;
        }
        return totalWeightedVotes;
    }

    public async update(handleVotes = true, updateMessage = true): Promise<{ passed: boolean; failed: boolean; }> {
        let totalWeightedVotes = this.voteScore;
        let response = {passed: false, failed: false};

        //vote passes
        if (totalWeightedVotes >= EnvConfig.settings.requiredVotes) {
            response = {passed: true, failed: false};
            Logger.info(`Vote passed with ${totalWeightedVotes} votes.`);
            if (handleVotes) {
                await this.executeSuccessfulVote().catch(error => {
                    Logger.error(`Failed to handle successful vote: ${error.message}`);
                });
            }
        }

        //vote fails
        if (Date.now() > this.expiry.getTime()) {
            response = {passed: false, failed: true};
            await this.updateMessage(await this.generateMessage(response)).catch(error => {
                Logger.error(`Failed to update vote message: ${error.message}`);
            });
            VoteManager.clearActiveVote();
        }

        if (updateMessage) {
            await this.updateMessage(await this.generateMessage({...response, cancelled: false}));
        }

        return response;
    }

    public addVote(user: GuildMember): `voteAdded` | `ineligble` | `alreadyVoted` {
        if (this.votes.has(user.id)) {
            Logger.warn(`User ${user.user.username} (${user.id}) has already voted in this vote.`);
            return `alreadyVoted`; // User has already voted
        } else {
            // the rolewights are sorted from highest to lowest, so we can
            for (const roleWeight of EnvConfig.settings.roleWeights) {
                if (user.roles.cache.has(roleWeight.roleId)) {
                    this.votes.set(user.id, roleWeight.weight);
                    Logger.info(`User ${user.user.username} (${user.id}) has voted with weight ${roleWeight.weight}.`);
                    this.update(); // Update the vote status after adding a new vote
                    return `voteAdded`; // Vote added successfully
                }
            }
            Logger.warn(`User ${user.user.username} (${user.id}) does not have a valid role to vote.`);
            return `ineligble`; // Role not found, vote not added
        }
    }

    public removeVote(user: User): boolean {
        if (this.votes.has(user.id)) {
            this.votes.delete(user.id);
            return true; // Vote removed successfully
        }
        this.update();
        return false; // User has not voted
    }

    public async cancelVote(): Promise<void> {
        let status = await this.update(true, false);
        if (status.passed || status.failed) {
            this.updateMessage(await this.generateMessage(status));
            Logger.warn(`Vote has already been resolved. Cannot cancel.`);
            return;
        }

        await this.updateMessage(await this.generateMessage({ failed: false, passed: false, cancelled: true }));
        VoteManager.clearActiveVote();
    }

    // #region private thingies
    private async generateMessage(o: {
        passed: boolean, 
        failed: boolean,
        cancelled?: boolean
    } = {
        passed: false,
        failed: false,
        cancelled: false
    }) : Promise<MessageCreateOptions> {
        await DatabaseManager.instance.Users.findAll({
            where: {
                userId: { [Op.ne]: this.instigator.id }
            }}
        ).then(users => {
            this.pingString = users.map(user => `<@${user.userId}>`).join(``);
            this.pingIds = users.map(user => user.userId);
        }).catch(error => {
            Logger.error(`Failed to fetch users for ping string: ${error.message}`);
            this.pingString = `<@${this.instigator.id}>`; // Fallback to instigator if fetching fails
        });

        let voteString = this.votes.size === 0 ? `No votes yet.` : Array.from(this.votes.entries())
            .sort((a, b) => a[1] - b[1])
            .map(([userId, weight]) => `- **<@${userId}>** - ${weight}`)
            .join(`\n`);

        // change this to use the built in colors
        let color:ColorResolvable = Colors.DarkOrange; // Default color for the vote message
        if (o.passed) {
            color = Colors.Green; // Green color for passed votes
        } else if (o.failed) {
            color = Colors.Red; // Red color for failed votes
        } else if (o.cancelled) {
            color = Colors.Grey; // Grey color for cancelled votes
        }

        let mainMessage = `<@${this.instigator.id}> (${this.instigator.user.username}) has begun a vote to remove <@${this.target.id}> (${this.target.user.username})'s roles.\n\nThe roles removed would be:\n${this.rolesStrings.join(`, `)}`;
        if (o.passed) {
            mainMessage += `\n\nThe vote has passed with ${this.votes.size} votes.`;
        } else if (o.failed) {
            mainMessage += `\n\nThe vote has failed.`;
        } else if (o.cancelled) {
            mainMessage += `\n\nThe vote has been cancelled.`;
        }

        if (EnvConfig.isTestMode) {
            mainMessage += `\n\n-# COMB is currently operating in test mode.`
        }

        if (EnvConfig.isDevMode) {
            mainMessage += `\n\n-# COMB is currently operating in dev mode.`
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
                                        id: this._voteId
                                    }
                                })).setDisabled(o.passed || o.failed || o.cancelled)
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`# Emergency Vote`),
                        ),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(mainMessage),
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
                                    n: "addVote",
                                    cD: {
                                        id: this._voteId
                                    }
                                }))
                                .setDisabled(o.passed || o.failed || o.cancelled),
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Secondary)
                                .setLabel(`Remove Vote`)
                                .setCustomId(JSON.stringify({
                                    t: "button",
                                    n: "removeVote",
                                    cD: {
                                        id: this._voteId
                                    }
                                }))
                                .setDisabled(o.passed || o.failed || o.cancelled),
                        ),
                ),
        ];
        return { components: components, allowedMentions: { roles: [], users: [] }, flags: [MessageFlags.IsComponentsV2]};
    }

    private async sendMessage(): Promise<Message> {
        if (this.message) {
            Logger.warn(`Vote message already exists. Not sending a new one.`);
            return this.message; // If the message already exists, return it
        }

        const channel = await Luma.instance.channels.fetch(EnvConfig.settings.voteChannelId);
        if (!channel || !channel.isSendable()) {
            throw new Error(`Vote channel not found or is not a text channel.`);
        }
        channel.sendTyping(); // Indicate that the bot is typing
        let message = await this.generateMessage();
        await channel.send({ content: this.pingString });
        this.message = await channel.send(message);
        return this.message; // Return the newly sent message
    }

    private async updateMessage(genMessage: MessageCreateOptions): Promise<void> {
        if (!this.message) {
            Logger.error(`Vote message is not set. Cannot update message.`);
            return;
        }
        this.message.edit({ content: genMessage.content, components: genMessage.components}).catch(error => {
            Logger.error(`Failed to update vote message: ${error.message}`)
        });
    }

    private async executeSuccessfulVote(): Promise<void> {
        if (EnvConfig.isDevMode) {
            Logger.log(`Remove roles disabled due to developer mode`);
            return; // Do not remove roles in dev mode
        }

        await this.target.roles.set([]);
        Logger.log(`Removed roles from ${this.target.id}`)
        for (let additionalGuild of EnvConfig.settings.additionalGuilds) {
            await Luma.instance.guilds.fetch(additionalGuild).then(async guild => {
                await guild.members.fetch(this.target.id).then(async member => {
                    Logger.log(`Removing roles from additional server ${guild.name} (${guild.id})`);
                    Logger.log(`Removing ${member.roles.cache.map(r => `${r.name} (${r.id})`).join(`, `)}`)
                    await member.roles.set([]);
                })
            })
        }
    }

    private static clearActiveVote() {
        if (VoteManager._instance) {
            Logger.info(`Clearing VoteManager instance for vote ID: ${VoteManager._instance.voteId}`);
            VoteManager._instance = null; // Clear the instance after handling the vote
        } else {
            Logger.warn(`No active VoteManager instance to clear.`);
        }
    }
    // #endregion
}