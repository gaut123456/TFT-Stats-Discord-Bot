const { connect, clientDB } = require('../../db');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your TFT profile')
        .addStringOption(option =>
            option.setName('region')
                .setDescription('The region of the summoner')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('username')
                .setDescription('The username to get the rank for')
                .setRequired(false)),
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
