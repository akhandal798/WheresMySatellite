const express = require('express');
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const cors = require('cors');

require('dotenv').config()

app.use(cors());

const app = express();
const PORT = 3000;

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


//enables express to expect json from incoming requests and parse it
//then store that in req.body
app.use(express.json());

//serve static files on the front end
console.log("serving frontend")
app.use(express.static(path.join(__dirname, '../client')));

//Connect once before server starts
client.connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on PORT: ${PORT}`)
    });
  })
  .catch(err => {
    console.error('Failed to connect to DB', err);
  });

//Method to serve data back to the front end
app.post('/getSatelliteData', async (req, res) => {
    const {satellite, time} = req.body;
    try {
        const insertQuery = `
            SELECT date, latitude, longitude
            FROM SatelliteData
            WHERE satname = $1 AND date >= NOW() - INTERVAL '${time} minutes'
            ORDER BY date ASC
        `;

        const result = await client.query(insertQuery, [satellite]);
        console.log(result.rows);
        res.json(result.rows);
        console.log(`Data Sent to Frontend`);
    } catch (err) {
        console.error('Query error:', err);
        res.status(500).send('Server error');
    }
});
