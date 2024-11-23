// db.js
const { MongoClient } = require("mongodb");
require('dotenv').config();

const uri = process.env.MONGO_URI;
const clientDB = new MongoClient(uri);

async function connect() {
  try {
    await clientDB.connect();
    console.log("Connected to the database");
  } catch (error) {
    console.error("Error connecting to the database", error);
  }
}

async function disconnect() {
  try {
    await clientDB.close();
    console.log("Disconnected from the database");
  } catch (error) {
    console.error("Error disconnecting from the database", error);
  }
}

module.exports = { clientDB, connect, disconnect };
