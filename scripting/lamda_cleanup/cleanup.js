const axios = require('axios');
const satellite = require('satellite.js');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

//Comment for Lambda
//require('dotenv').config()

async function cleanup() {

    // SQL connection config
    const client = new Client({
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: process.env.PG_PORT,
        ssl: {
            ca: fs.readFileSync(path.join(__dirname, 'certificates', 'global-bundle.pem')).toString()
        }
    })
    
    //Connect to sql server
    console.log("Trying to connect");
    try {
        await client.connect();
        console.log("Connected to SQL server");
    } catch (err) {
        console.error("Failed to connect to SQL Server", err);
        return;
    }

    //Delete Old Data
    try {

        const insertQuery = `
            DELETE FROM SatelliteData 
            WHERE date < NOW() - INTERVAL '4 hours'
        `;

        await client.query(insertQuery)

        console.log(`Successfully Deleted Data Older Than 24 Hours`)
    } catch (err) {
        console.error(`Failure In Deleting Data`, err)
    }
    
    //close server connection
    await client.end();
    console.log("DB Connection Closed")
}

//Local Testing
//cleanup();

//Lambda Integrations
exports.handler = async (event) => {
    await cleanup();
}