import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable, Colors, ContainerBuilder, GuildMember, Message, MessageActionRowComponentBuilder, MessageCreateOptions, MessageFlags, Role, SectionBuilder, SendableChannels, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, User } from "discord.js";
import { EnvConfig } from "./EnvConfig.ts";
import { DatabaseManager } from "./Database.ts";
import { Op } from "sequelize";
import { Logger } from "./Logger.ts";
import crypto from "node:crypto";
import { Luma } from "./Luma.ts";
import ms from "ms";

export class VoteManager {
    private static _instance: VoteManager | null = null;
    public instigator: GuildMember;
    public target: GuildMember;
    public roles: Role[]; // Roles to remove from the target if the vote passes. Not to be used when removing roles.
    public votes: Map<string, number>; // Map of user IDs to their vote data
    public message: Message | undefined; // Message to update with vote results
    public channel: SendableChannels | undefined; // Channel where the vote is sent, can be used to send messages
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

    constructor(instigator: GuildMember, target: GuildMember, channelId: string) {
        if (VoteManager._instance) {
            throw new Error("VoteManager instance already exists. Use getInstance() instead.");
        }
        this.instigator = instigator;
        this.target = target;
        this.votes = new Map<string, number>();
        this.expiry = new Date(Date.now() + EnvConfig.settings.timeout); // Set expiry based on configuration
        this._voteId = crypto.randomBytes(8).toString("base64url");
        this.roles = target.roles.cache.filter(role => !role.managed && role.name !== `@everyone`).map(role => role);
        this.pingString = `Unset`;
        this.pingIds = [this.instigator.id]; // Ping instigator and target by default
        let channel = Luma.instance.channels.cache.get(channelId); // Fetch the channel where the vote will be sent if it exists in the cache
        if (channel && channel.isSendable()) {
            this.channel = channel;
        }
        this.sendMessage(channelId);
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
        let response = { passed: false, failed: false };

        //vote passes
        if (totalWeightedVotes >= EnvConfig.settings.requiredVotes) {
            response = { passed: true, failed: false };
            Logger.info(`Vote passed with ${totalWeightedVotes} votes.`);
            if (handleVotes) {
                await this.executeSuccessfulVote().catch(error => {
                    Logger.error(`Failed to handle successful vote: ${error.message}`);
                });
            }
            if (updateMessage) {
                await this.updateMessage(await this.generateMessage(response)).catch(error => {
                    Logger.error(`Failed to update vote message: ${error.message}`);
                });
            }
            VoteManager.clearActiveVote();
            return response; // Vote passed, return early
        }

        //vote fails
        if (Date.now() > this.expiry.getTime()) {
            response = { passed: false, failed: true };
            await this.updateMessage(await this.generateMessage(response)).catch(error => {
                Logger.error(`Failed to update vote message: ${error.message}`);
            });
            VoteManager.clearActiveVote();
            return response; // Vote failed, return early
        }

        if (updateMessage) {
            await this.updateMessage(await this.generateMessage({ ...response, cancelled: false }));
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
        let existed = false;
        if (this.votes.has(user.id)) {
            this.votes.delete(user.id);
            existed = true;
        }
        this.update();
        return existed; // User has not voted
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
        }): Promise<MessageCreateOptions> {
        this.channel?.sendTyping(); // Indicate that the bot is typing in the channel
        let isFinished = o.passed || o.failed || o.cancelled;
        await DatabaseManager.instance.Users.findAll({
            where: {
                userId: { [Op.ne]: this.target.id }
            }
        }
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

        voteString = `### Total Weighted Votes: ${this.voteScore} / ${EnvConfig.settings.requiredVotes}\n\n` + voteString;

        // change this to use the built in colors
        let color: ColorResolvable = Colors.DarkOrange; // Default color for the vote message
        if (o.passed) {
            color = Colors.Green; // Green color for passed votes
        } else if (o.failed) {
            color = Colors.Red; // Red color for failed votes
        } else if (o.cancelled) {
            color = Colors.Grey; // Grey color for cancelled votes
        }

        let mainMessage = `<@${this.instigator.id}> (${this.instigator.user.username}) has begun a vote to remove <@${this.target.id}> (${this.target.user.username})'s roles.\n\nThe roles removed would be:\n${this.roles.map(role => `<@&${role.id}> (${role.name} - ${role.id})`).join(`, `)}`;
        if (o.passed) {
            voteString += `\n\n**The vote has passed with ${this.votes.size} votes.**`;
        } else if (o.failed) {
            voteString += `\n\n**The vote has failed.**`;
        } else if (o.cancelled) {
            voteString += `\n\n**The vote has been cancelled.**`;
        }

        let tinyinfo = ``
        if (EnvConfig.isTestMode) {
            tinyinfo += `\n-# COMB is currently operating in test mode.`
        }

        if (EnvConfig.isDevMode) {
            tinyinfo += `\n-# COMB is currently operating in dev mode.`
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
                                })).setDisabled(isFinished)
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
                                .setDisabled(isFinished),
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
                                .setDisabled(isFinished),
                        ),
                ).addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`-# This vote ${isFinished ? `expired` : `will expire`} at <t:${Math.floor(this.expiry.getTime() / 1000)}:f>. ID: ${this._voteId}${tinyinfo}`),
                )
        ];
        return { components: components, allowedMentions: { roles: [], users: [] }, flags: [MessageFlags.IsComponentsV2] };
    }

    private async sendMessage(channelId: string): Promise<Message> {
        if (this.message) {
            Logger.warn(`Vote message already exists. Not sending a new one.`);
            return this.message; // If the message already exists, return it
        }

        if (!this.channel) {
            let channel = await Luma.instance.channels.fetch(channelId);
            if (!channel || !channel.isSendable()) {
                Logger.error(`Vote channel not found or is not a text channel.`);
                throw new Error(`Vote channel not found or is not a text channel.`);
            }
            this.channel = channel;
        }
        this.channel.sendTyping(); // Indicate that the bot is typing in the channel
        let message = await this.generateMessage();
        await this.channel.send({ content: this.pingString });
        this.message = await this.channel.send(message);
        return await this.message; // Send the message and return it
    }

    private async updateMessage(genMessage: MessageCreateOptions): Promise<void> {
        if (!this.message) {
            Logger.error(`Vote message is not set. Cannot update message.`);
            return;
        }
        this.message.edit({ components: genMessage.components, allowedMentions: genMessage.allowedMentions }).catch(error => {
            Logger.error(`Failed to update vote message: ${error.message}`)
        });
    }

    private async executeSuccessfulVote(): Promise<void> {
        if (EnvConfig.isDevMode) {
            Logger.log(`Remove roles disabled due to developer mode`);
            return; // Do not remove roles in dev mode
        }

        this.channel?.sendTyping();
        this.target.roles.set([]).then(() => {
            Logger.log(`Removed roles from ${this.target.user.username} (${this.target.id})`);
            this.channel?.send({
                content: `Successfully removed roles from ${this.target.user.username} (${this.target.id}).`,
            });
        }).catch(error => {
            Logger.error(`Failed to remove roles from ${this.target.user.username} (${this.target.id}): ${error.message}`);
            this.channel?.send({
                content: `Failed to remove roles from ${this.target.user.username} (${this.target.id}). Please check the logs for more details.`,
            });
        });
        for (let additionalGuild of EnvConfig.settings.additionalGuilds) {
            if (additionalGuild == "" || additionalGuild == "0") {
                continue; // Skip empty or invalid guild IDs
            }
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
            VoteManager._instance._updateInterval && clearInterval(VoteManager._instance._updateInterval);
            VoteManager._instance = null; // Clear the instance after handling the vote
        } else {
            Logger.warn(`No active VoteManager instance to clear.`);
        }
    }
    // #endregion
}

/*
let botHighestRole = this.target.guild.members.me?.roles.highest;
        if (!botHighestRole) {
            Logger.error(`Bot's highest role not found. Cannot remove roles from target.`);
            return; // Bot's highest role not found, cannot proceed
        }
        this.target.roles.cache.forEach(async role => {
            if (role.comparePositionTo(botHighestRole) > 0) {
                Logger.warn(`Cannot remove role ${role.name} (${role.id}) from ${this.target.user.username} (${this.target.id}) because it is higher than or equal to the bot's highest role.`);
                return;
            }
            if (role.managed) {
                Logger.warn(`Will not remove managed role ${role.name} (${role.id}) from ${this.target.user.username} (${this.target.id}).`);
                return; // Skip managed roles
            }
            if (role.name === `@everyone`) {
                Logger.warn(`Will not remove @everyone role from ${this.target.user.username} (${this.target.id}).`);
                return; // Skip @everyone role
            }
            Logger.log(`Removing role ${role.name} (${role.id}) from ${this.target.user.username} (${this.target.id})`);
            await this.target.roles.remove(role).catch(error => {
                Logger.error(`Failed to remove role ${role.name} (${role.id}) from ${this.target.user.username} (${this.target.id}): ${error.message}`);
            });
        });
        */