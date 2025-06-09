import ms from "ms";

const DEFAULT_CONFIG = {
    database: {
        dialect: `sqlite`, // database dialect, can be `sqlite` or `postgres`
        connectionString: `:memory:` // if sqlite, this is the path to the database file; if postgres, this is the connection string
    },
    settings: {
        timeout: 1000 * 60 * 30, // default timeout for votes in milliseconds
        requiredVotes: 1, // number of votes required to pass a vote
        allowedRoles: [`0`], // list of role IDs that are allowed to start a vote
        roleWeights: [{
            roleId: `0`, // role ID for the weight
            weight: 0 // weight of votes made by members of the role id
        }],
        guildId: `0` // guild ID for the bot to operate in
    }
}

export class EnvConfig {
    public static database = DEFAULT_CONFIG.database;
    public static settings = DEFAULT_CONFIG.settings;

    public static get isDevMode(): boolean {
        return process.env.NODE_ENV === `development` || process.env.NODE_ENV === `dev`;
    }

    public static get isTestMode(): boolean {
        return process.env.NODE_ENV === `test`;
    }

    public static load(): void {
        this.database.dialect = process.env.DATABASE_DIALECT || DEFAULT_CONFIG.database.dialect;
        this.database.connectionString = process.env.DATABASE_CONNECTION_STRING || DEFAULT_CONFIG.database.connectionString;

        this.settings.timeout = parseInt(process.env.VOTE_TIMEOUT || String(DEFAULT_CONFIG.settings.timeout));
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
    }
}