const axios = require('axios');
const satellite = require('satellite.js');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const AWS = require('aws-sdk')

//Comment for Lambda
require('dotenv').config()

//S3 Config for Local Testing
AWS.config.update({region: process.env.AWS_REGION || 'us-east-2'});

//S3 Details
const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;

/** Define Object Correlating Satellites Name to ID 
 *  Necessary because we need to ping the API via Satellie ID, not name
*/
const satelliteIds = Object.freeze({
    ISSZarya: 25544,
    NOAA19: 33591,
    LANDSAT9: 49260,
    SWISSCUBE: 35932,
    NORSAT1: 42826,

})

async function s3_to_rds() {

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
   
    //Get S3 Objects
    let latestKeys = [];

    try {

        //Call S3 API to list all objects in bucket, end with promise
        const listResponse = await s3.listObjectsV2({
            Bucket:  bucketName,
            Prefix:  `satellite-data`,
        }).promise();

        //Extract Keys from S3, empty array as a fallback
        objectKeys = (listResponse.Contents || []).map(obj => obj.Key);

        //Error handling
        if (objectKeys.length === 0) {
            console.log("No Data Found");
            await client.end();
            return;
        }

    } catch (err) {
        console.error("Error With S3 Objects", err);
        await client.end();
        return
    }

    console.log(objectKeys)

    //DB Query
    const insertQuery = `
        INSERT INTO SatelliteData (SatName, Date, Latitude, Longitude)
        VALUES ($1, $2, $3, $4)
    `;

    //Write to DB and Delete After Writing
    for (const key of objectKeys) {
        try {

            //Download contents of JSON file, convert to string and unpack
            const s3Object = await s3.getObject({ Bucket: bucketName, Key: key }).promise();
            const records = JSON.parse(s3Object.Body.toString());

            //Place data into RDS
            for (const { SatName, Date, Latitude, Longitude } of records) {
                await client.query(insertQuery, [SatName, Date, Latitude, Longitude]);
                console.log(`Inserted ${SatName}`);
            }
        
            try  {
                await s3.deleteObject({ Bucket: bucketName, Key: key }).promise();
                console.log(`Processed & deleted: ${key}`);
            } catch (err) {
                console.error(`Failed to delete ${SatName}}`, err)
            }

        } catch (err) {
            console.error(`Failed to process ${key}`, err)
        }
    } 
    
    //close server connection
    await client.end();
    console.log("DB Connection Closed")
}

//Local Testing
s3_to_rds();

//Lambda Integrations
exports.handler = async (event) => {
    await s3_to_rds();
}