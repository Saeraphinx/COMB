import { DatabaseManager, User } from "./Database.ts";
import { EnvConfig } from "./EnvConfig.ts";
import { Logger } from "./Logger.ts";
import { Luma } from "./Luma.ts";

export class IdleJobs {


    public static async init(luma: Luma): Promise<void> {
        Logger.debug(`Initializing idle jobs...`);
        if (EnvConfig.isDevMode) {
            IdleJobs.attemptToPullAllUsers(luma);
        }
    }

    private static async attemptToUpdateUsersInDatabase(luma: Luma) {
        const users = await DatabaseManager.instance.Users.findAll();
        for (let user of users) {
            let guildUser = await (await luma.guilds.fetch(EnvConfig.settings.guildId)).members.fetch(user.userId);
            User.updateUser(guildUser);
        }
    }

    private static attemptToPullAllUsers(luma: Luma): void {
        luma.guilds.fetch(EnvConfig.settings.guildId).then(guild => {
            guild.roles.fetch().then(roles => {
                EnvConfig.settings.roleWeights.forEach(roleWeight => {
                    const role = roles.get(roleWeight.roleId);
                    if (!role) {
                        console.warn(`Role with ID ${roleWeight.roleId} not found in guild ${guild.name}`);
                        return;
                    }
                });

                // while itd be nicer to do this asynchronously, the database locks if you dont.
                guild.members.fetch({ time: 1000 * 60 * 5 }).then(async members => {
                    for (const member of members.values()) {
                        await User.updateUser(member);
                    }
                }).catch(error => {
                    console.error(`Failed to fetch members for guild ${guild.name}:`, error);
                });
            })
        })
    }
}