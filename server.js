const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();

// -------------------- MIDDLEWARE --------------------
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "my-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// -------------------- DATABASE CONNECTION --------------------
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root", // change if needed
  database: "music-reviews",
  port: 8889,
});

db.connect((err) => {
  if (err) throw err;
  console.log("✅ Connected to MySQL");
});

// -------------------- PAGE ROUTES --------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "musicreviews.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/signup.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// -------------------- AUTH ROUTES --------------------

// Register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ success: false, message: "Username and password required." });

  try {
    const hash = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [username, hash],
      (err) => {
        if (err) {
          console.error(err);
          return res.json({ success: false, message: "Username already exists." });
        }
        res.json({ success: true, message: "✅ User registered successfully!" });
      }
    );
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Registration error." });
  }
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, results) => {
      if (err || results.length === 0)
        return res.json({ success: false, message: "Invalid username or password." });

      const user = results[0];
      const match = await bcrypt.compare(password, user.password_hash);

      if (match) {
        req.session.userId = user.user_id;
        req.session.username = user.username;
        res.json({ success: true, username: user.username });
      } else {
        res.json({ success: false, message: "Invalid password." });
      }
    }
  );
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Check current session status
app.get("/session", (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

// Middleware to require login
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Login required." });
  }
  next();
}

// -------------------- ARTISTS & REVIEWS --------------------

// Fetch all artists
app.get("/artists", (req, res) => {
  db.query("SELECT * FROM artists", (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// Fetch reviews for a given artist
app.get("/reviews/:artistId", (req, res) => {
  const sql = `
    SELECT r.review_id, r.review_title, r.review_description, r.star_rating,
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

// Add new review (must be logged in)
app.post("/addreview", requireLogin, (req, res) => {
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

  // Step 1: Create album
  db.query(
    "INSERT INTO albums (artist_id, album_title) VALUES (?, ?)",
    [artist_id, album_title],
    (err, albumResult) => {
      if (err) throw err;
      const albumId = albumResult.insertId;

      // Step 2: Create track
      db.query(
        "INSERT INTO tracks (album_id, track_title, track_length, track_artwork) VALUES (?, ?, ?, ?)",
        [albumId, track_title, track_length, track_artwork],
        (err, trackResult) => {
          if (err) throw err;
          const trackId = trackResult.insertId;

          // Step 3: Create reviewer record (linked to username)
          db.query(
            "INSERT INTO reviewers (reviewer_name) VALUES (?)",
            [reviewer_name],
            (err, reviewerResult) => {
              if (err) throw err;
              const reviewerId = reviewerResult.insertId;

              // Step 4: Create review
              const sql = `
                INSERT INTO reviews 
                (reviewer_id, track_id, review_title, review_description, star_rating)
                VALUES (?, ?, ?, ?, ?)
              `;
              const values = [
                reviewerId,
                trackId,
                review_title,
                review_description,
                star_rating
              ];

              db.query(sql, values, (err) => {
                if (err) throw err;
                res.json({ success: true, artistId: artist_id });
              });
            }
          );
        }
      );
    }
  );
});

// Delete review (only if it's the user's own)
app.post("/deletereview", requireLogin, (req, res) => {
  const { review_id } = req.body;
  const username = req.session.username;

  const checkSql = `
    SELECT r.review_id
    FROM reviews r
    JOIN reviewers rv ON r.reviewer_id = rv.reviewer_id
    WHERE rv.reviewer_name = ? AND r.review_id = ?;
  `;

  db.query(checkSql, [username, review_id], (err, results) => {
    if (err) throw err;
    if (results.length === 0) {
      return res
        .status(403)
        .json({ success: false, message: "You can only delete your own reviews." });
    }

    db.query("DELETE FROM reviews WHERE review_id = ?", [review_id], (err) => {
      if (err) throw err;
      res.json({ success: true });
    });
  });
});

// -------------------- START SERVER --------------------
app.listen(3000, () =>
  console.log("🚀 Server running at http://localhost:3000")
);
