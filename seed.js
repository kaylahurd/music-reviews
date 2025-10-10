const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",  // 👈 this line is key
  database: "music-reviews",
  port: 8889          // 👈 make sure to use MAMP’s port (default 8889)
});


const seedArtists = `
INSERT INTO artists (artist_name, artist_description, artist_picture)
VALUES
('Frank Ocean', 'R&B artist known for Channel Orange and Blonde', 'images/frankocean.jpg'),
('Tyler, The Creator', 'Genre-blending artist and producer', 'images/tyler.jpg'),
('Travis Scott', 'Rapper and producer from Houston', 'images/travis.jpg'),
('Playboi Carti', 'Known for Whole Lotta Red and unique sound', 'images/carti.jpg'),
('Yeat', 'Experimental trap artist', 'images/yeat.jpg');
`;

db.query(seedArtists, (err) => {
  if (err) throw err;
  console.log("✅ Artists added!");
  db.end();
});
