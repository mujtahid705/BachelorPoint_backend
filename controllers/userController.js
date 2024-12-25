import express from "express";
import { db } from "../server.js";
import bcrypt from "bcrypt";
import multer from "multer";
import jwt from "jsonwebtoken";
import authenticateToken from "../middleware/authenticateToken.js";

const router = express.Router();

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// CONTROLLER FUNCTIONS
const allUsers = async (req, res) => {
  const { email } = req.user;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
    if (err) {
      return res.status(400).json({ error: err });
    }
    const type = result[0].type;

    if (type !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    db.query("SELECT * FROM users", (err, result) => {
      if (err) {
        return res.status(400).json({ error: err });
      }
      return res.json(result);
    });
  });
};

const registerUser = async (req, res) => {
  const { studentId, name, email, password, gender } = req.body;
  const idCard = req.file ? req.file.buffer.toString("base64") : null;

  if (!studentId || !name || !email || !password || !gender || !idCard) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (studentId, name, email, password, gender, idCard) VALUES (?, ?, ?, ?, ?, ?)",
      [studentId, name, email, hashedPassword, gender, idCard],
      (err, result) => {
        if (err) {
          console.error("Error inserting user:", err);
          return res.status(400).json({ error: err });
        }
        console.log("User registered successfully:", result);
        return res.json({ message: "User registered successfully" });
      }
    );
  } catch (err) {
    console.error("Error hashing password:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    db.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
      async (err, result) => {
        if (err) {
          return res.status(400).json({ error: err });
        }

        if (result.length === 0) {
          return res.status(400).json({ error: "User not found" });
        }

        const user = result[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return res.status(400).json({ error: "Invalid password" });
        }

        const token = jwt.sign(
          { id: user.id, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        return res.json({
          message: "Login successful",
          token: token,
          user: user,
        });
      }
    );
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ROUTES
// GET All users
router.get("/", authenticateToken, allUsers);

// register user
router.post("/register", upload.single("idCard"), registerUser);

// login user
router.post("/login", loginUser);

export default router;
