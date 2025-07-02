let map;
let flightPath = null;
let latestData = [];

//Initialize Map Once Page Loads
window.initMap = function() {
    console.log("initMap called");
    map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: 0,
    mapTypeId: 'satellite',
    gestureHandling: 'greedy',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    restriction: {
      latLngBounds: {
        north: 85,
        south: -85,
        west: -180,
        east: 180
      },
      strictBounds: true
    }
  });
}
//Clear markers from the map
function clearPath() {
    if (flightPath) {
        flightPath.setMap(null);
        flightPath = null;
    }
}

document.getElementById('satForm').addEventListener('submit', function(e) {
   
    //Stop form from reloading page
    e.preventDefault();
    console.log("Submit clicked");

    //Grab the two inputs to the backend, the satellite and time history
    const satellite = document.getElementById('sats').value;
    const time = parseInt(document.getElementById('times').value, 10);

    const request = {
        satellite: satellite,
        time: time
    };

    const gmap = document.getElementById('map');
    const info = document.getElementById('info');
    //info.innerHTML = '';
    //info.innerHTML = '<p>Loading...</p>';

    //Direct the request with the body of the JSON being composed of the satellite and time
    fetch('https://wheresmysatellitebackend.onrender.com', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({satellite, time})
    })
    .then(res => res.json()) //Convert the response back to json
    .then(data => { //Take the coordinates and put them on the page

        latestData = data;
        clearPath();

        if (data.length === 0) {
            info.innerHTML = '<p>No data available for that time range.</p>';
        } else {
            
            flightPath = new google.maps.Polyline({
                path: data.map(point => ({
                    lat: point.latitude,
                    lng: point.longitude,
                })),
                geodesic: true,
                strokeColor: "#FF0000",
                strokeOpacity: 1.0,
                strokeWeight: 2,
            })

            flightPath.setMap(map);
        }

    }).catch(err => {
        console.error('Error:', err)
        info.innerHTML = '<p>Error loading data.</p>';
    })

})

document.getElementById('clear').addEventListener('click', function(e) {
    clearPath();
})

document.getElementById('export').addEventListener('click', function(e) {
    if (!latestData.length) {
        alert("No data to export.")
        return;
    }

    //Make header, join together, then join strings of longitude and latitude to the array
    const headers = ["Latitude", "Longitude"];
    const csvRows = [
        headers.join(","),  
        ...latestData.map(row =>
        [row.latitude, row.longitude].join(",")
    )
    ];

    //Join all rows into a string separated by newlines
    const csvContent = csvRows.join("\n");
    //Create file to download
    const blob = new Blob([csvContent], { type: "text/csv" });
    //Creates temporary link
    const url = URL.createObjectURL(blob);

    //Create fake anchor tag, set href to blob url, set attribute to download and fake a click on it
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'satellite_data.csv');
    a.click();
})