const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { clientDB } = require('../../db');
const getSummonerPuuid = require('../../RiotRequest/getSummonerPuuid');
const getSummonerID = require('../../RiotRequest/getSummonerID');
const getSummonerRank = require('../../RiotRequest/getSummonerRank');
const getLastGamesID = require('../../RiotRequest/GetLastGamesID');
const getLastGamesPositions = require('../../RiotRequest/GetLastPositions');
const ddragon_version = process.env.ddragon_version;

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

const positionEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

function getRankColor(tier) {
    const rankColors = {
        'IRON': '#452700',
        'BRONZE': '#7A5312',
        'SILVER': '#7B7B7B',
        'GOLD': '#EFB917',
        'PLATINUM': '#4DA1A9',
        'DIAMOND': '#576BCE',
        'MASTER': '#9D4DC5',
        'GRANDMASTER': '#D13639',
        'CHALLENGER': '#E4E4E4'
    };
    return rankColors[tier] || '#0099ff';
}

function getRankEmoji(tier) {
    const rankEmojis = {
        'IRON': '🔨',
        'BRONZE': '🥉',
        'SILVER': '🥈',
        'GOLD': '🥇',
        'PLATINUM': '💎',
        'DIAMOND': '💠',
        'MASTER': '👑',
        'GRANDMASTER': '⚜️',
        'CHALLENGER': '🏆'
    };
    return rankEmojis[tier] || '🎮';
}

function calculateStats(positions) {
    if (!positions.length) return { winRate: '0.0', top4Rate: '0.0', avgPlacement: '0.00' };
    
    const totalGames = positions.length;
    const wins = positions.filter(pos => pos === 1).length;
    const top4 = positions.filter(pos => pos <= 4).length;
    const avgPlacement = (positions.reduce((a, b) => a + b, 0) / totalGames).toFixed(2);
    
    return {
        winRate: ((wins / totalGames) * 100).toFixed(1),
        top4Rate: ((top4 / totalGames) * 100).toFixed(1),
        avgPlacement
    };
}

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
    await collection.updateOne(
        { username: username.toLowerCase(), region: region },
        {
            $set: {
                puuid: summonerPuuid.puuid,
                id: summonerID.id,
                profileIconId: summonerID.profileIconId,
                lastUpdated: Date.now()
            }
        },
        { upsert: true }
    );

    return {
        puuid: summonerPuuid.puuid,
        id: summonerID.id,
        profileIconId: summonerID.profileIconId
    };
}

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
        try {
            await interaction.deferReply();

            let username = interaction.options.getString('summoner');
            let region = interaction.options.getString('region');

            if (!username || !region) {
                try {
                    const db = clientDB.db();
                    const collection = db.collection('tft_profiles');
                    const savedProfile = await collection.findOne({ discordUser: interaction.user.id });

                    if (!savedProfile) {
                        return await interaction.editReply('Please provide a username and region or link your TFT profile with /link');
                    }

                    username = savedProfile.username;
                    region = savedProfile.region;
                } catch (dbError) {
                    console.error('Database Error:', dbError);
                    return await interaction.editReply('Error accessing user profile. Please try again or use /link to set up your profile.');
                }
            }

            try {
                // Get cached or fresh summoner data
                const summonerData = await getCachedSummonerData(username, region);
                const summonerRank = await getSummonerRank.getSummonerRank(region, summonerData.id);
                const lastGamesID = await getLastGamesID.getLastGamesID(region, summonerData.puuid);

                const lastGamePositionsPromises = lastGamesID.map(gameID => 
                    getLastGamesPositions.getLastPositions(region, gameID)
                        .catch(error => {
                            console.error(`Error fetching game ${gameID}:`, error);
                            return null;
                        })
                );

                const lastGamePositions = await Promise.all(lastGamePositionsPromises);

                const lastGamePositionsArray = lastGamePositions
                    .filter(position => position !== null)
                    .map(position => position?.info?.participants
                        ?.filter(participant => participant?.puuid === summonerData.puuid)
                        ?.map(participant => participant.placement))
                    .flat()
                    .filter(Boolean);

                const stats = calculateStats(lastGamePositionsArray);
                const rankTier = summonerRank[0]?.tier || 'UNRANKED';
                const positionsAsEmojis = lastGamePositionsArray
                    .slice(0, 10)
                    .map(placement => positionEmojis[placement - 1])
                    .join(' ') || 'No recent games';

                const profileIconUrl = `http://ddragon.leagueoflegends.com/cdn/${ddragon_version}/img/profileicon/${summonerData.profileIconId}.png`;

                const embed = new EmbedBuilder()
                    .setColor(getRankColor(rankTier))
                    .setTitle(`${getRankEmoji(rankTier)} ${username}'s TFT Profile`)
                    .setDescription(`**Region:** ${region.toUpperCase()}`)
                    .setThumbnail(profileIconUrl)
                    .addFields(
                        { 
                            name: '🏅 Current Rank', 
                            value: rankTier === 'UNRANKED' 
                                ? 'Unranked'
                                : `${rankTier} ${summonerRank[0].rank}\n${summonerRank[0].leaguePoints} LP`, 
                            inline: true 
                        },
                        { 
                            name: '📊 Stats', 
                            value: `Win Rate: ${stats.winRate}%\nTop 4: ${stats.top4Rate}%\nAvg Place: ${stats.avgPlacement}`, 
                            inline: true 
                        },
                        { 
                            name: '🎮 Recent Games', 
                            value: positionsAsEmojis, 
                            inline: false 
                        }
                    )
                    .setFooter({ 
                        text: `Last ${lastGamePositionsArray.length} games • ${new Date().toLocaleDateString()}` 
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (apiError) {
                console.error('API Error:', apiError);
                await interaction.editReply('Error fetching summoner data. Please verify the username and region are correct.');
            }
        } catch (error) {
            console.error('Command Error:', error);
            try {
                if (interaction.deferred) {
                    await interaction.editReply('An error occurred while processing your request. Please try again later.');
                } else {
                    await interaction.reply({ content: 'An error occurred while processing your request. Please try again later.', ephemeral: true });
                }
            } catch (followUpError) {
                console.error('Error sending error message:', followUpError);
            }
        }
    },
};