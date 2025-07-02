import { DatabaseManager, User } from "./Database.ts";
import { EnvConfig } from "./EnvConfig.ts";
import { Logger } from "./Logger.ts";
import { Luma } from "./Luma.ts";

export async function attemptToUpdateUsersInDatabase() {
    const users = await DatabaseManager.instance.Users.findAll();
    for (let user of users) {
        let guildUser = await (await Luma.instance.guilds.fetch(EnvConfig.settings.guildId)).members.fetch(user.userId);
        User.updateUser(guildUser);
    }
}

export function attemptToPullAllUsers(): void {
    Luma.instance.guilds.fetch(EnvConfig.settings.guildId).then(async guild => {
        await guild.roles.fetch().then(async roles => {
            EnvConfig.settings.roleWeights.forEach(roleWeight => {
                const role = roles.get(roleWeight.roleId);
                if (!role) {
                    console.warn(`Role with ID ${roleWeight.roleId} not found in guild ${guild.name}`);
                    return;
                }
            });

            let lastId: string = "0";
            let lastCount = 1;
            while (lastCount > 0) {
                await guild.members.list({ after: lastId, limit: 1000 }).then(async users => {
                    lastCount = users.size;
                    if (lastCount > 0) {
                        Logger.debug(`Fetched ${lastCount} users from guild ${guild.name}`);
                        for (let user of users) {
                            await User.updateUser(user[1]);
                        }
                        lastId = users.last()?.id || "0";
                    } else {
                        Logger.debug(`No more users to fetch from guild ${guild.name}`);
                    }
                }).catch(error => {
                    Logger.error(`Error fetching users from guild ${guild.name}: ${error.message}`);
                });
            }
        })
    })
}