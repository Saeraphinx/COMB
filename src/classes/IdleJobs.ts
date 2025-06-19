import { DatabaseManager, User } from "./Database";
import { EnvConfig } from "./EnvConfig";
import { Logger } from "./Logger";
import { Luma } from "./Luma";

export class IdleJobs {

    private async attemptToUpdateUsersInDatabase(luma: Luma) {
        const users = await DatabaseManager.instance.Users.findAll();
        for (let user of users) {
            let guildUser = await (await luma.guilds.fetch(EnvConfig.settings.guildId)).members.fetch(user.userId);
            User.updateUser(guildUser);
        }
    }

    private attemptToPullAllUsers(luma: Luma): void {
        luma.guilds.fetch(EnvConfig.settings.guildId).then(guild => {
            guild.roles.fetch().then(roles => {
                EnvConfig.settings.roleWeights.forEach(roleWeight => {
                    const role = roles.get(roleWeight.roleId);
                    if (!role) {
                        console.warn(`Role with ID ${roleWeight.roleId} not found in guild ${guild.name}`);
                        return;
                    }
                });

                guild.members.fetch({ time: 1000 * 60 * 5 }).then(members => {
                    members.forEach(member => {
                        User.updateUser(member);
                    })
                }).catch(error => {
                    console.error(`Failed to fetch members for guild ${guild.name}:`, error);
                });
            })
        })
    }
}