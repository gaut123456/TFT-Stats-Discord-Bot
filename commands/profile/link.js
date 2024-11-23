const { connect, clientDB } = require('../../db');
const { SlashCommandBuilder } = require('discord.js');

const regions = [
    { name: 'NA', value: 'na1' },
    { name: 'BR', value: 'br1' },
    { name: 'LA1', value: 'la1' },
    { name: 'LA2', value: 'la2' },
    { name: 'KR', value: 'kr' },
    { name: 'JP', value: 'jp1' },
    { name: 'EUW', value: 'euw1' },
    { name: 'EUN', value: 'eun1' },
    { name: 'TR', value: 'tr1' },
    { name: 'RU', value: 'ru' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your TFT profile')
        .addStringOption(option =>
            option.setName('region')
                .setDescription('The region of the summoner')
                .setRequired(true)
                .addChoices(
                    ...regions.map(region => ({ name: region.name, value: region.value }))
                ))
        .addStringOption(option => 
            option.setName('username')
                .setDescription('The username to get the rank for')
                .setRequired(true)),
    async execute(interaction) {
        const username = interaction.options.getString('username');
        const region = interaction.options.getString('region');

        if (!username) {
            await interaction.reply('Please provide a username.');
            return;
        }

        if (!region) {  
            await interaction.reply('Please provide a region.');
            return;
        }

        await connect();

        const db = clientDB.db();  
        const collection = db.collection('tft_profiles'); 

        try {
            await collection.updateOne(
                { discordUser: interaction.user.id },
                { $set: { username, region } },
                { upsert: true }
            );
            console.log(`Linked account for ${username} in ${region}`);
        } catch (error) {
            console.error("Error saving to the database", error);
            await interaction.reply('There was an error linking your account.');
            return;
        }

        await interaction.reply(`Successfully linked your account for ${username} in ${region}`);
    },
};