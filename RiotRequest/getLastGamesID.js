require('dotenv').config({ path: '../.env' });

console.log(process.env.RIOT_API_KEY);


const REGIONAL_ENDPOINTS = {
    'na1': 'americas',
    'br1': 'americas',
    'la1': 'americas',
    'la2': 'americas',
    'kr': 'asia',
    'jp1': 'asia',
    'euw1': 'europe',
    'eun1': 'europe',
    'tr1': 'europe',
    'ru': 'europe'
};

const getLastGamesID = async (server, puuid) => {

    const region = REGIONAL_ENDPOINTS[server];
    console.log(region);
    try {


        const response = await fetch(
            `https://${region}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?count=10`,
            {
                method: 'GET',
                headers: {
                    'X-Riot-Token': process.env.RIOT_API_KEY
                }
            }
        );


        const data = await response.json();


        if (data.status) {
            console.log('API Response:', data);
            if (data.status.status_code === 403) {
                throw new Error('API Key invalid or expired. Please check your Riot API key.');
            }
        }

        return data;
    } catch (error) {
        console.error('Error fetching account:', error.message);
        return null;
    }


};


module.exports = { getLastGamesID };