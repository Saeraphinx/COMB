import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, ModelStatic, Sequelize } from 'sequelize';
import { Logger } from './Logger';
import { EnvConfig } from './EnvConfig';
import path from 'node:path';
import { APIGuildMember, GuildMember } from 'discord.js';

export class DatabaseManager {
    private sequelize: Sequelize;
    private static _instance: DatabaseManager;
    public Users: ModelStatic<User>;

    public static get instance(): DatabaseManager {
        if (!DatabaseManager._instance) {
            DatabaseManager._instance = new DatabaseManager();
        }
        return DatabaseManager._instance;
    }

    constructor() {
        if (DatabaseManager._instance) {
            return DatabaseManager._instance;
        }
        Logger.log(`Creating DatabaseManager...`);
        DatabaseManager._instance = this;

        if (EnvConfig.database.dialect === `sqlite`) {
            const storagePath = path.resolve(EnvConfig.database.connectionString);
            Logger.log(`Using SQLite database at ${storagePath}`);
            this.sequelize = new Sequelize({
                dialect: EnvConfig.database.dialect,
                storage: storagePath
            });
        } else if (EnvConfig.database.dialect === `postgres`) {
            Logger.log(`Using PostgreSQL database`);
            this.sequelize = new Sequelize(EnvConfig.database.connectionString, {
                dialect: EnvConfig.database.dialect,
            });
        } else {
            process.exit(1); // unsupported database dialect
        }
    }

    public async connect() {
        Logger.log(`Connecting to database...`);
        return await this.sequelize.authenticate().then(() => {
            Logger.log(`Database connection successful.`);
        }).catch((error) => {
            Logger.error(`Database connection failed: ${error.message}`);
            process.exit(1);
        });
    }

    public async closeConnenction() {
        Logger.log(`Closing database connection...`);
        return await this.sequelize.close().then(() => {
            Logger.log(`Database connection closed.`);
        }).catch((error) => {
            Logger.error(`Failed to close database connection: ${error.message}`);
        });
    }

    public async init() {
        Logger.log(`Initializing DatabaseManager...`);

        await this.connect();
        this.loadTables();
        await this.sequelize.sync().then(() => {
            Logger.log(`Database synced successfully.`);
        }).catch((error) => {
            Logger.error(`Failed to sync database: ${error.message}`);
            process.exit(1);
        });
    }

    public loadTables() {
        Logger.log(`Loading database tables...`);

        this.Users = User.init({
            userId: {
                type: DataTypes.STRING,
                allowNull: false,
                primaryKey: true,
                unique: true
            },
            username: {
                type: DataTypes.STRING,
                allowNull: false
            },
            roleId: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: null
            }
        }, {
            sequelize: this.sequelize,
            tableName: `users`,
            timestamps: false,
        });
    }
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare userId: string;
    declare username: string;
    declare roleId: string | null;


    public static async updateUser(member: GuildMember | APIGuildMember) {
        if (member.user.bot) {
            return;
        }

        for (const roleWeight of EnvConfig.settings.roleWeights) {
            if (
                (member instanceof GuildMember && member.roles.cache.has(roleWeight.roleId)) ||
                (Array.isArray(member.roles) && member.roles.includes(roleWeight.roleId))
            ) {
                Logger.info(`Setting weight for user ${member.user.username} (${member.user.id}) to ${roleWeight.weight} due to role ${roleWeight.roleId}`);
                await DatabaseManager.instance.Users.findOrCreate({
                    where: { userId: member.user.id },
                    defaults: { username: member.user.username, userId: member.user.id }
                }).then(async ([user, created]) => {
                    if (created) {
                        Logger.info(`Created new user entry for ${member.user.username} (${member.user.id})`);
                    }
                    if (user.roleId !== roleWeight.roleId) {
                        await user.update({ roleId: roleWeight.roleId }).then(() => {
                            Logger.info(`Updated weight for user ${member.user.username} (${member.user.id}) to ${roleWeight.weight}`);
                        }).catch(error => {
                            Logger.error(`Failed to update weight for user ${member.user.username} (${member.user.id}): ${error}`,);
                        });
                    }
                })
            } else {
                await User.destroy({
                    where: { userId: member.user.id }
                }).then(() => {
                    Logger.info(`Removed user ${member.user.username} (${member.user.id}) from database due to role change.`);
                }).catch(error => {
                    Logger.error(`Failed to remove user ${member.user.username} (${member.user.id}) from database: ${error}`);
                });
            }
        }
    }
}