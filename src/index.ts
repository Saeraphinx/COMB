import { Client, IntentsBitField } from 'discord.js';
import { Luma } from './classes/Luma.ts';
import { EnvConfig } from './classes/EnvConfig.ts';
import { Logger } from './classes/Logger.ts';

let bot = new Luma({
    intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent],
});

bot.login(EnvConfig.bot.token).then(() => {
    Logger.info(`Logged in as ${bot.user?.tag} (${bot.user?.id})`);
}).catch((error) => {
    Logger.error(`Failed to login: ${error.message}`);
});
