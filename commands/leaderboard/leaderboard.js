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

async function getCachedSummonerData(username, region) {
    const db = clientDB.db();
    const collection = db.collection('summoner_cache');
    
    const cachedData = await collection.findOne({ 
        username: username.toLowerCase(), 
        region: region 
    });

    if (cachedData && cachedData.lastUpdated > Date.now() - (24 * 60 * 60 * 1000)) {
        return cachedData;
    }
    
    // If cache miss or expired, fetch new data
    const summonerPuuid = await getSummonerPuuid.getSummonerPuuid(region, username);
    const summonerID = await getSummonerID.getSummonerID(region, summonerPuuid.puuid);
    
    // Update cache
    const newData = {
        puuid: summonerPuuid.puuid,
        id: summonerID.id,
        lastUpdated: Date.now()
    };

    await collection.updateOne(
        { username: username.toLowerCase(), region: region },
        { $set: newData },
        { upsert: true }
    );

    return newData;
}

async function getRankWithRetry(region, summonerId, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await getSummonerRank.getSummonerRank(region, summonerId);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays the current TFT leaderboard'),
    
    async execute(interaction) {
        await interaction.deferReply();
        await connect();
        
        try {
            const db = clientDB.db();
            const collection = db.collection('tft_profiles');
            const users = await collection.find().toArray();

            if (!users.length) {
                await interaction.editReply('No profiles linked yet. Be the first to join!');
                return;
            }

            const leaderboard = [];
            // Process users in parallel with a concurrency limit
            const chunkSize = 5; // Process 5 users at a time to avoid rate limits
            for (let i = 0; i < users.length; i += chunkSize) {
                const chunk = users.slice(i, i + chunkSize);
                const promises = chunk.map(async user => {
                    try {
                        const { region, username } = user;
                        const cleanUsername = username.split('#')[0];
                        
                        // Get cached summoner data
                        const summonerData = await getCachedSummonerData(username, region);
                        
                        // Get rank info with retry mechanism
                        const summonerRank = await getRankWithRetry(region, summonerData.id);
                        const rankInfo = summonerRank[0] || { tier: 'UNRANKED', rank: '', leaguePoints: 0 };

                        return {
                            username: cleanUsername,
                            region,
                            rank: rankInfo.tier,
                            division: rankInfo.rank,
                            rankOrder: rankData[rankInfo.tier]?.order || 0,
                            divisionOrder: divisionOrder[rankInfo.rank] || 0,
                            lp: rankInfo.leaguePoints,
                        };
                    } catch (error) {
                        console.error(`Error processing user ${user.username}:`, error);
                        return null;
                    }
                });

                const results = await Promise.all(promises);
                leaderboard.push(...results.filter(result => result !== null));
                
                // Add a small delay between chunks to avoid rate limits
                if (i + chunkSize < users.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
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
                .setTitle('TFT Ranked Leaderboard - Top 10');

            const medals = ['🥇', '🥈', '🥉'];
            let playersColumn = '';
            let ranksColumn = '';

            leaderboard.slice(0, 10).forEach((profile, index) => {
                let position;
                if (index < 3) {
                    position = medals[index];
                } else {
                    position = `${index + 1}. `;
                }
                
                const rankDisplay = profile.division ?
                    `${profile.rank} ${profile.division} ${profile.lp} LP` :
                    `${profile.rank} ${profile.lp} LP`;

                playersColumn += `${position} ${profile.username}\n`;
                ranksColumn += `${rankDisplay}\n`;
            });

            embed.addFields(
                { name: 'Players', value: playersColumn || 'No players found', inline: true },
                { name: 'Rank', value: ranksColumn || 'No ranks found', inline: true }
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in leaderboard command:', error);
            await interaction.editReply('An error occurred while fetching the leaderboard. Please try again later.');
        }
    },
};