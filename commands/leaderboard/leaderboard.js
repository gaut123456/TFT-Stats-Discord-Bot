const { connect, clientDB } = require('../../db');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const getSummonerPuuid = require('../../RiotRequest/getSummonerPuuid');
const getSummonerID = require('../../RiotRequest/getSummonerID');
const getSummonerRank = require('../../RiotRequest/getSummonerRank');
const getLastGamesID = require('../../RiotRequest/GetLastGamesID');

const rankData = {
    'IRON': { order: 1, color: 0x51545C },
    'BRONZE': { order: 2, color: 0xA84300 },
    'SILVER': { order: 3, color: 0x95989A },
    'GOLD': { order: 4, color: 0xF1C40F },
    'PLATINUM': { order: 5, color: 0x2EAED0 },
    'DIAMOND': { order: 6, color: 0x2E6BE6 },
    'MASTER': { order: 7, color: 0x9B59B6 },
    'GRANDMASTER': { order: 8, color: 0xE74C3C },
    'CHALLENGER': { order: 9, color: 0xF1C40F }
};

const divisionOrder = {
    'IV': 4,
    'III': 3,
    'II': 2,
    'I': 1
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays the current TFT leaderboard'),
    
    async execute(interaction) {
        await interaction.deferReply();
        await connect();
        const db = clientDB.db();
        const collection = db.collection('tft_profiles');
        const users = await collection.find().toArray();

        if (!users.length) {
            await interaction.editReply('No profiles linked yet. Be the first to join!');
            return;
        }

        const leaderboard = [];
        for (const user of users) {
            const { region, username } = user;
            const cleanUsername = username.split('#')[0];
            
            const summonerPuuid = await getSummonerPuuid.getSummonerPuuid(region, username);
            const summonerID = await getSummonerID.getSummonerID(region, summonerPuuid.puuid);
            const summonerRank = await getSummonerRank.getSummonerRank(region, summonerID.id);
            
            const rankInfo = summonerRank[0] || { tier: 'UNRANKED', rank: '', leaguePoints: 0 };
            leaderboard.push({
                username: cleanUsername,
                region,
                rank: rankInfo.tier,
                division: rankInfo.rank,
                rankOrder: rankData[rankInfo.tier]?.order || 0,
                divisionOrder: divisionOrder[rankInfo.rank] || 0,
                lp: rankInfo.leaguePoints,
            });
        }

        leaderboard.sort((a, b) => {
            if (a.rankOrder === b.rankOrder) {
                if (a.divisionOrder === b.divisionOrder) {
                    return b.lp - a.lp;
                }
                return a.divisionOrder - b.divisionOrder;
            }
            return b.rankOrder - a.rankOrder;
        });

        const embed = new EmbedBuilder()
            .setColor(0x2E6BE6)
            .setTitle('TFT Ranked Leaderboard - Top 10')
        // Create medal emojis for top 3
        const medals = ['🥇', '🥈', '🥉'];

        // Create two columns
        let playersColumn = '';
        let ranksColumn = '';

        leaderboard.slice(0, 10).forEach((profile, index) => {
            let position;
            if (index < 3) {
                position = medals[index];
            } else {
                // Add extra spaces after numbers for alignment with medals
                position = `${index + 1}.  `;
            }
            
            const rankDisplay = profile.division ? 
                `${profile.rank} ${profile.division} ${profile.lp} LP` : 
                `${profile.rank} ${profile.lp} LP`;

            playersColumn += `${position} ${profile.username}\n`;
            ranksColumn += `${rankDisplay}\n`;
        });

        embed.addFields(
            { name: 'Players', value: playersColumn, inline: true },
            { name: 'Rank', value: ranksColumn, inline: true }
        );

        await interaction.editReply({ embeds: [embed] });
    },
};