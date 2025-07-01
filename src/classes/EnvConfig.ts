import ms, { StringValue } from "ms";

const DEFAULT_CONFIG = {
    database: {
        dialect: `sqlite`, // database dialect, can be `sqlite` or `postgres`
        connectionString: `:memory:` // if sqlite, this is the path to the database file; if postgres, this is the connection string
    },
    settings: {
        timeout: ms(`30m`), // default timeout for votes in milliseconds
        requiredVotes: 1, // number of votes required to pass a vote
        allowedRoles: [`0`], // list of role IDs that are allowed to start a vote
        roleWeights: [{
            roleId: `0`, // role ID for the weight
            weight: 0 // weight of votes made by members of the role id
        }],
        guildId: `0`, // guild ID for the bot to operate in
        additionalGuilds: [`0`]
    },
    bot: {
        token: ``, // bot token
    },
    tasks: {
        refreshAllUsersInterval: ms(`30d`), // interval to refresh all users in the guild
        updateUsersInDatabaseInterval: ms(`1d`), // interval to update users in the database
    }
}

export class EnvConfig {
    public static database = DEFAULT_CONFIG.database;
    public static settings = DEFAULT_CONFIG.settings;
    public static bot = DEFAULT_CONFIG.bot;
    public static tasks = DEFAULT_CONFIG.tasks;

    public static get isDevMode(): boolean {
        return process.env.NODE_ENV === `development` || process.env.NODE_ENV === `dev`;
    }

    public static get isTestMode(): boolean {
        return process.env.NODE_ENV === `test`;
    }

    public static init(): void {
        this.database.dialect = process.env.DATABASE_DIALECT || DEFAULT_CONFIG.database.dialect;
        this.database.connectionString = process.env.DATABASE_CONNECTION_STRING || DEFAULT_CONFIG.database.connectionString;

        this.settings.timeout = parseMsValueFromEnv(`VOTE_TIMEOUT`, DEFAULT_CONFIG.settings.timeout);
        this.settings.requiredVotes = process.env.REQUIRED_VOTES ? parseInt(process.env.REQUIRED_VOTES) : DEFAULT_CONFIG.settings.requiredVotes;
        this.settings.allowedRoles = process.env.ALLOWED_ROLES ? process.env.ALLOWED_ROLES.split(`,`) : DEFAULT_CONFIG.settings.allowedRoles;
        this.settings.roleWeights = process.env.ROLE_WEIGHTS ? 
            process.env.ROLE_WEIGHTS.split(`,`).map((roleWeight) => {
                const [roleId, weight] = roleWeight.split(`:`);
                return { roleId, weight: parseInt(weight) };
            }) : 
            DEFAULT_CONFIG.settings.roleWeights;

        this.settings.roleWeights.sort((a, b) => {
            return b.weight - a.weight; // sort by weight in descending order
        })
        this.settings.guildId = process.env.GUILD_ID || DEFAULT_CONFIG.settings.guildId;
        this.settings.additionalGuilds = process.env.ADDITIONAL_GUILDS?.split(`,`) || []
        this.bot.token = process.env.BOT_TOKEN || DEFAULT_CONFIG.bot.token;
        this.tasks.refreshAllUsersInterval = parseMsValueFromEnv(`REFRESH_ALL_USERS_INTERVAL`, DEFAULT_CONFIG.tasks.refreshAllUsersInterval);
        this.tasks.updateUsersInDatabaseInterval = parseMsValueFromEnv(`UPDATE_USERS_IN_DATABASE_INTERVAL`, DEFAULT_CONFIG.tasks.updateUsersInDatabaseInterval);
    }
}

function parseMsValueFromEnv(envVarName: string, defaultValue: number): number {
    try {
        const value = process.env[envVarName];
        if (value) {
            const parsedValue = ms(value as StringValue);
            if (typeof parsedValue === `number`) {
                return parsedValue;
            }
        }
    } catch (error) {
        console.error(`Error parsing environment variable ${envVarName}:`, error);
    }
    return defaultValue;
}