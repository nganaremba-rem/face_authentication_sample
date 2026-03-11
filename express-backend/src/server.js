// Import the Express framework.
// Express is a popular Node.js library used to create web servers and APIs.
const express = require("express");

// Import bcrypt library.
// bcrypt is used to hash passwords securely.
const bcrypt = require("bcrypt");

// Import axios library.
// axios is used to send HTTP requests to other services (our Python AI service).
const axios = require("axios");

// Import UUID generator.
// UUIDs are unique identifiers used for challenge tokens.
const { v4: uuidv4 } = require("uuid");

// Import CORS middleware.
// This allows a frontend (running on another port) to call this backend.
const cors = require("cors");

// Create an Express application instance.
const app = express();

// Allow JSON requests in the body.
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Enable CORS for all routes.
app.use(cors());

// ------------------------------------------------
// IN-MEMORY STORAGE
// ------------------------------------------------

// users map stores registered users.
//
// key = username
// value = { passwordHash, embedding }
const users = new Map();

// challenges map stores active liveness challenges.
//
// key = challengeToken
// value = { direction, livenessPassed }
const challenges = new Map();

// ------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------

// Function to compute cosine similarity between two vectors.
//
// Face embeddings are arrays of numbers representing a face.
// Cosine similarity checks how similar the vectors are.
function cosineSimilarity(a, b) {
  // Compute dot product
  let dot = 0;

  // Compute magnitude of vector A
  let normA = 0;

  // Compute magnitude of vector B
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];

    normA += a[i] * a[i];

    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dot / (normA * normB);
}

// Function to randomly choose a direction
function randomDirection() {
  return Math.random() < 0.5 ? "left" : "right";
}

// ------------------------------------------------
// CREATE LIVENESS CHALLENGE
// ------------------------------------------------

// POST /challenge
// This endpoint creates a liveness challenge.
app.post("/challenge", (_req, res) => {
  // Generate unique token
  const token = uuidv4();

  // Randomly choose head turn direction
  const direction = randomDirection();

  // Store challenge in memory
  challenges.set(token, {
    direction,
    livenessPassed: false,
  });

  // Return challenge to frontend
  res.json({
    token,
    direction,
  });
});

// ------------------------------------------------
// VERIFY LIVENESS
// ------------------------------------------------

// POST /verify-liveness
app.post("/verify-liveness", async (req, res) => {
  const { token, frames } = req.body;

  // Check if challenge exists
  if (!challenges.has(token)) {
    return res.json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  const challenge = challenges.get(token);

  try {
    console.log({
      frames,
      direction: challenge.direction,
    });
    // Send frames to Python AI service
    const response = await axios.post("http://liveness:8000/analyze", {
      frames,
      direction: challenge.direction,
    });

    const result = response.data;

    // If AI service confirms liveness
    if (result.passed) {
      challenge.livenessPassed = true;

      return res.json({
        success: true,
        message: "Liveness confirmed",
      });
    }

    return res.json({
      success: false,
      message: result.reason || "Liveness failed",
    });
  } catch (err) {
    // If Python service is unreachable
    return res.json({
      success: false,
      message: "AI service unavailable",
    });
  }
});

// ------------------------------------------------
// REGISTER USER
// ------------------------------------------------

// POST /register
app.post("/register", async (req, res) => {
  const { token, user, password, embedding } = req.body;

  // Verify challenge exists
  if (!challenges.has(token)) {
    return res.json({
      success: false,
      message: "Invalid token",
    });
  }

  const challenge = challenges.get(token);

  // Check if liveness passed
  if (!challenge.livenessPassed) {
    return res.json({
      success: false,
      message: "Liveness not verified",
    });
  }

  // Prevent duplicate usernames
  if (users.has(user)) {
    return res.json({
      success: false,
      message: "User already exists",
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Store user
  users.set(user, {
    passwordHash,
    embedding,
  });

  // Remove challenge
  challenges.delete(token);

  res.json({
    success: true,
    message: "Registered successfully",
    user,
  });
});

// ------------------------------------------------
// LOGIN USER
// ------------------------------------------------

// POST /login
app.post("/login", async (req, res) => {
  const { token, embedding, user, password } = req.body;

  // -----------------------------
  // FACE LOGIN
  // -----------------------------
  if (token && embedding) {
    if (!challenges.has(token)) {
      return res.json({
        success: false,
        message: "Invalid token",
      });
    }

    const challenge = challenges.get(token);

    if (!challenge.livenessPassed) {
      return res.json({
        success: false,
        message: "Liveness not verified",
      });
    }

    let bestUser = null;
    let bestScore = 0;

    // Compare embedding with every stored user
    for (const [username, record] of users.entries()) {
      const similarity = cosineSimilarity(embedding, record.embedding);

      if (similarity > bestScore) {
        bestScore = similarity;
        bestUser = username;
      }
    }

    // If similarity high enough
    if (bestUser && bestScore > 0.8) {
      challenges.delete(token);

      return res.json({
        success: true,
        message: `Welcome back, ${bestUser}!`,
        user: bestUser,
      });
    }

    return res.json({
      success: false,
      message: "Face not recognized",
    });
  }

  // -----------------------------
  // PASSWORD LOGIN
  // -----------------------------
  if (user && password) {
    if (!users.has(user)) {
      return res.json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const record = users.get(user);

    const valid = await bcrypt.compare(password, record.passwordHash);

    if (valid) {
      return res.json({
        success: true,
        message: `Welcome back, ${user}!`,
        user,
      });
    }

    return res.json({
      success: false,
      message: "Invalid username or password",
    });
  }

  res.json({
    success: false,
    message: "Provide face login or password login",
  });
});

// ------------------------------------------------
// START SERVER
// ------------------------------------------------

// Start Express server on port 3000
app.listen(3000, "0.0.0.0", () => {
  console.log("Backend running on port 3000");
});
