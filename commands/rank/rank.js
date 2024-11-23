const { SlashCommandBuilder } = require('discord.js');
const { clientDB } = require('../../db');
const getSummonerPuuid = require('../../RiotRequest/getSummonerPuuid');
const getSummonerID = require('../../RiotRequest/getSummonerID');
const getSummonerRank = require('../../RiotRequest/getSummonerRank');

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
        .setName('rank')
        .setDescription('Replies with your current TFT rank')
        .addStringOption(option =>
            option.setName('region')
                .setDescription('The region of the summoner')
                .setRequired(false)
                .addChoices(...regions))
        .addStringOption(option => 
            option.setName('summoner')
                .setDescription('The username to get the rank for')
                .setRequired(false)),
    async execute(interaction) {
        let username = interaction.options.getString('summoner');
        let region = interaction.options.getString('region');

        if (!username || !region) {
            const db = clientDB.db();
            const collection = db.collection('tft_profiles');
            
            const savedProfile = await collection.findOne({ discordUser: interaction.user.id });

            if (!savedProfile) {
                await interaction.reply('Please provide a username and region or link your TFT profile with /link');
                return;
            }

            username = savedProfile.username;
            region = savedProfile.region;
        }

        await interaction.deferReply();

        try {
            console.log(`Fetching account for ${username} in ${region}`);
            const summonerPuuid = await getSummonerPuuid.getSummonerPuuid(region, username);
            const summonerID = await getSummonerID.getSummonerID(region, summonerPuuid.puuid);
            const summonerRank = await getSummonerRank.getSummonerRank(region, summonerID.id);

            await interaction.editReply(`Rank for ${username}: ${summonerRank[0].tier} ${summonerRank[0].rank} ${summonerRank[0].leaguePoints} LP`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('There was an error fetching the rank. Please try again later.');
        }
    },
};