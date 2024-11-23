require('dotenv').config({ path: '../.env' });

const getSummonerID = async (server, puuid) => {
    try {


        const response = await fetch(
            `https://${server}.api.riotgames.com/tft/summoner/v1/summoners/by-puuid/${puuid}`,
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


module.exports = { getSummonerID };