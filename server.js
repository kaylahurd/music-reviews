const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "music-reviews",
  port: 8889
});

db.connect(err => {
  if (err) throw err;
  console.log("✅ Connected to MySQL");
});

// Serve main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/musicreviews.html"));
});

// Fetch all artists for dropdowns
app.get("/artists", (req, res) => {
  db.query("SELECT * FROM artists", (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// Fetch reviews for a given artist
app.get("/reviews/:artistId", (req, res) => {
  const sql = `
    SELECT r.review_title, r.review_description, r.star_rating,
           rv.reviewer_name, t.track_title, t.track_length, t.track_artwork,
           a.album_title, ar.artist_name, ar.artist_picture
    FROM reviews r
    JOIN reviewers rv ON r.reviewer_id = rv.reviewer_id
    JOIN tracks t ON r.track_id = t.track_id
    JOIN albums a ON t.album_id = a.album_id
    JOIN artists ar ON a.artist_id = ar.artist_id
    WHERE ar.artist_id = ?;
  `;
  db.query(sql, [req.params.artistId], (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// Add a new review
app.post("/addreview", (req, res) => {
  const {
    artist_id,
    album_title,
    track_title,
    track_length,
    track_artwork,
    reviewer_name,
    review_title,
    review_description,
    star_rating
  } = req.body;

  db.query(
    "INSERT INTO albums (artist_id, album_title) VALUES (?, ?)",
    [artist_id, album_title],
    (err, albumResult) => {
      if (err) throw err;
      const albumId = albumResult.insertId;

      db.query(
        "INSERT INTO tracks (album_id, track_title, track_length, track_artwork) VALUES (?, ?, ?, ?)",
        [albumId, track_title, track_length, track_artwork],
        (err, trackResult) => {
          if (err) throw err;
          const trackId = trackResult.insertId;

          db.query(
            "INSERT INTO reviewers (reviewer_name) VALUES (?)",
            [reviewer_name],
            (err, reviewerResult) => {
              if (err) throw err;
              const reviewerId = reviewerResult.insertId;

              db.query(
                "INSERT INTO reviews (reviewer_id, track_id, review_title, review_description, star_rating) VALUES (?, ?, ?, ?, ?)",
                [reviewerId, trackId, review_title, review_description, star_rating],
                (err) => {
                  if (err) throw err;
                  res.json({ success: true, artistId: artist_id });
                }
              );
            }
          );
        }
      );
    }
  );
});

app.listen(3000, () => console.log("🚀 Server running at http://localhost:3000"));
