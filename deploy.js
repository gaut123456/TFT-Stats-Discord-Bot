require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const clientId = process.env.CLIENT_ID;
const token = process.env.TOKEN;

console.log(`Client ID: ${clientId}`);
console.log(`Token: ${token ? 'Loaded' : 'Not Loaded'}`);

const commands = [];
// Grab all the command folders from the commands directory you created earlier
const foldersPath = path.join(__dirname, 'commands');
if (!fs.existsSync(foldersPath)) {
    console.log(`[ERROR] The commands directory at ${foldersPath} does not exist.`);
    process.exit(1);
}
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    // Grab all the command files from the commands directory you created earlier
    const commandsPath = path.join(foldersPath, folder);
    if (!fs.existsSync(commandsPath)) {
        console.log(`[ERROR] The command folder at ${commandsPath} does not exist.`);
        continue;
    }
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    if (commandFiles.length === 0) {
        console.log(`[WARNING] No command files found in ${commandsPath}.`);
        continue;
    }
    // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`[INFO] Loaded command ${file} from ${filePath}.`);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

console.log(`Total commands loaded: ${commands.length}`);

// Deploy commands to Discord
const rest = new REST({ version: '9' }).setToken(token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();