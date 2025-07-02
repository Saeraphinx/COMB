import { Client, IntentsBitField } from 'discord.js';
import { Luma } from './classes/Luma.ts';
import { EnvConfig } from './classes/EnvConfig.ts';
import { Logger } from './classes/Logger.ts';
import { DatabaseManager } from './classes/Database.ts';
import { IdleJobs } from './classes/IdleJobs.ts';

EnvConfig.init();
Logger.init();
let db = new DatabaseManager();
await db.init().catch((error) => {
    Logger.error(`Failed to initialize database: ${error.message}`);
    process.exit(1);
});

let bot = new Luma({
    intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent],
});
await bot.init();

bot.login(EnvConfig.bot.token).then(() => {
    Logger.info(`Logged in as ${bot.user?.tag} (${bot.user?.id})`);
    IdleJobs.init(bot);
}).catch((error) => {
    Logger.error(`Failed to login: ${error.message}`);
    process.exit(1);
});

// Handle rejection of promises
process.on('unhandledRejection', (reason, promise) => {
    
    if (EnvConfig.isDevMode) {
        Logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    }
});