const axios = require('axios');
const satellite = require('satellite.js');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk')

//Comment for Lambda
//require('dotenv').config()

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

const radToDeg = radians => radians * (180/Math.PI);

async function fetchSatelliteData() {

    const satelliteData = [];

    //Create an array turning the object into an array of name and ID pairs
    //Loop over with .map
    const promises = Object.entries(satelliteIds).map(async ([satName, satelliteId]) => {
        
        try {
            const response = await axios.get(`http://tle.ivanstanojevic.me/api/tle/${satelliteId}`)

            /** Pull raw data from API response */
            let satNameResp = response.data.name;
            let date = response.data.date;
            let line1 = response.data.line1;
            let line2 = response.data.line2;

            console.log(response.data.line1)
            console.log(response.data.line2)

            /** Create satellite object/record */
            let satObj = satellite.twoline2satrec(line1, line2)

            console.log(response.data)

            /** Propogate the position and velocity with time since epoch, ideally 0 */
            let now = new Date();
            let positionAndVelocity = satellite.propagate(satObj, now)
            /** Posiiton in Earth Centered Inertial Frame */
            let positionECI = positionAndVelocity.position;

            /** Time in Greenwich Mean Sidereal Time */
            let gmst = satellite.gstime(now);
            /** Generalized Coordinates */
            let positionGd = satellite.eciToGeodetic(positionECI, gmst)
            /** Extract latitude and longitude */
            let longitude = radToDeg(positionGd.longitude);
            let latitude = radToDeg(positionGd.latitude);

            //null check prior to pushing data
            if (!positionECI) {
                console.warn(`Propogation failed for ${satName}`);
                return
            }

            satelliteData.push({
                SatName: satNameResp,
                Date: now.toISOString(),
                Latitude: latitude,
                Longitude: longitude,
            });

        } catch (error)  {
            console.error(`Error fetching data for ${satelliteId}`, error)
        }
    })

    await Promise.all(promises)

    //timestamp for the s3 file name
    //replace all colons and periods with hyphens for compatability
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    //filename
    const objectKey = `satellite-data-${timestamp}.json`;

    const s3Params = {
        Bucket: bucketName,
        Key: objectKey,
        Body: JSON.stringify(satelliteData, null, 2),   //no replace function, indent each nested level with 2 spaces
        ContentType: 'application/json',                //tells S3 it's JSON
    }

    try {
        await s3.putObject(s3Params).promise();
        console.log('Successfully Uploaded Data')
    } catch (err) {
        console.error('Failed upload', err)
    }

}

//Local Testing
//fetchSatelliteData();

//Lambda Integrations
exports.handler = async (event) => {
    await fetchSatelliteData();
}