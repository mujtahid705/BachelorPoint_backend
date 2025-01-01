import express from "express";
import { db } from "../server.js";
import bcrypt from "bcrypt";
import multer from "multer";
import jwt from "jsonwebtoken";
import authenticateToken from "../middleware/authenticateToken.js";

import fs from "fs";
import path from "path";
import { promisify } from "util";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// CONTROLLER FUNCTIONS
// GET all users
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

// Register user
const writeFile = promisify(fs.writeFile);

const registerUser = async (req, res) => {
  const { studentId, name, email, password, gender, idCard } = req.body;

  if (!studentId || !name || !email || !password || !gender || !idCard) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Decode base64 image and save it to the filesystem
    const imageBuffer = Buffer.from(
      idCard.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );
    const imagePath = path.join(
      __dirname,
      "uploads",
      `${Date.now()}-${studentId}.png`
    );

    // Ensure the uploads directory exists
    const uploadsDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }

    // Write the file to the filesystem
    await writeFile(imagePath, imageBuffer);

    // Store user data in the database, including the image path
    const relativeImagePath = `uploads/${path.basename(imagePath)}`;

    // hasing the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // storing to the database
    db.query(
      "INSERT INTO users (studentId, name, email, password, gender, idCard) VALUES (?, ?, ?, ?, ?, ?)",
      [studentId, name, email, hashedPassword, gender, relativeImagePath],
      (err, result) => {
        if (err) {
          console.error("Error inserting user:", err);

          // Delete the image if the user registration fails
          fs.unlink(imagePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Error deleting image:", unlinkErr);
            } else {
              console.log("Unnecessary image deleted.");
            }
          });
          return res.status(400).json({ error: err });
        }
        console.log("User registered successfully:", result);
        return res.json({ message: "User registered successfully" });
      }
    );
  } catch (err) {
    console.error("Error:", err);

    // Delete the image if the user registration fails
    fs.unlink(imagePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error("Error deleting image:", unlinkErr);
      } else {
        console.log("Unnecessary image deleted.");
      }
    });
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Login user
const loginUser = async (req, res) => {
  const { studentId, password } = req.body;

  if (!studentId || !password) {
    return res
      .status(400)
      .json({ error: "Student Id and password are required" });
  }

  try {
    db.query(
      "SELECT * FROM users WHERE studentId = ?",
      [studentId],
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
          {
            studentId: user.studentId,
            email: user.email,
            type: user.type,
            status: user.status,
          },
          process.env.JWT_SECRET
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

// Get self data by token
const selfData = async (req, res) => {
  const { email } = req.user;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
    if (err) {
      return res.status(400).json({ error: err });
    }
    const { name, email, studentId, bio, dp, gender, type, idCard, status } =
      result[0];
    return res.json({
      name,
      email,
      studentId,
      bio,
      dp,
      gender,
      type,
      idCard,
      status,
    });
  });
};

// Approve user by ID
const approveUser = (req, res) => {
  const { email } = req.user;
  const { id } = req.params;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
    if (err) {
      return res.status(400).json({ error: err });
    }
    const type = result[0].type;

    if (type !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    db.query(
      "UPDATE users SET status = 'approved' WHERE studentId = ?",
      [id],
      (err, result) => {
        if (err) {
          return res.status(400).json({ error: err });
        }
        return res.json({ message: "User approved" });
      }
    );
  });
};

// Delete user by ID
const deleteUser = (req, res) => {
  const { email } = req.user;
  const { id } = req.params;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
    if (err) {
      return res.status(400).json({ error: err });
    }
    const type = result[0].type;

    if (type !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    db.query("DELETE FROM users WHERE studentId = ?", [id], (err, result) => {
      if (err) {
        return res.status(400).json({ error: err });
      }
      return res.json({ message: "User deleted successfully" });
    });
  });
};

// Ban user by ID
const banUser = (req, res) => {
  const { email } = req.user;
  const { id } = req.params;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
    if (err) {
      return res.status(400).json({ error: err });
    }
    const type = result[0].type;

    if (type !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    db.query(
      "UPDATE users SET status = 'not approved', type = 'user' WHERE studentId = ?",
      [id],
      (err, result) => {
        if (err) {
          return res.status(400).json({ error: err });
        }
        return res.json({ message: "User banned" });
      }
    );
  });
};

// Make admin by ID
const makeAdmin = (req, res) => {
  const { type } = req.user;
  const { id } = req.params;

  if (type !== "admin") {
    return res.status(403).json({ error: "Access denied" });
  }

  db.query(
    "UPDATE users SET type = 'admin' WHERE studentId = ?",
    [id],
    (err, result) => {
      if (err) {
        return res.status(400).json({ error: err });
      }
      return res.json({ message: "New Admin added" });
    }
  );
};

// Update user
const updateUser = async (req, res) => {
  const { studentId } = req.user;
  const { bio, dp } = req.body;

  if (!bio || !dp) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Decode base64 image and save it to the filesystem
    const imageBuffer = Buffer.from(
      dp.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );
    const imagePath = path.join(
      __dirname,
      "dp",
      `${Date.now()}-${studentId}.png`
    );

    // Ensure the uploads directory exists
    const uploadsDir = path.join(__dirname, "dp");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }

    // Write the file to the filesystem
    await writeFile(imagePath, imageBuffer);

    // Store user data in the database, including the image path
    const relativeImagePath = `dp/${path.basename(imagePath)}`;

    // updating the database
    db.query(
      "UPDATE users SET bio = ?, dp = ? WHERE studentId = ?",
      [bio, relativeImagePath, studentId],
      (err, result) => {
        if (err) {
          console.error("Error updating user:", err);

          // Delete the image if the user update fails
          fs.unlink(imagePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Error deleting image:", unlinkErr);
            } else {
              console.log("Unnecessary image deleted.");
            }
          });
          return res.status(400).json({ error: err });
        }
        console.log("Updated successfully:", result);
        return res.json({ message: "Updated successfully" });
      }
    );
  } catch (err) {
    console.error("Error:", err);

    // Delete the image if the user registration fails
    fs.unlink(imagePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error("Error deleting image:", unlinkErr);
      } else {
        console.log("Unnecessary image deleted.");
      }
    });
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET contact
const getContact = (req, res) => {
  const { id } = req.params;
  const { studentId } = req.user;

  if (req.user.status === "not approved") {
    return res.status(400).json({ error: "Your account is not approved yet!" });
  }

  // Get user info based on studentId
  db.query(
    "SELECT * FROM users WHERE studentId = ?",
    [studentId],
    (err, userResult) => {
      if (err) {
        console.error("Error fetching user info:", err);
        return res.status(400).json({ error: err });
      }

      if (userResult.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = userResult[0];

      // Find the post from posts table based on id
      db.query("SELECT * FROM posts WHERE id = ?", [id], (err, postResult) => {
        if (err) {
          console.error("Error fetching post:", err);
          return res.status(400).json({ error: err });
        }

        if (postResult.length === 0) {
          return res.status(404).json({ error: "Post not found" });
        }

        const post = postResult[0];

        // Check if the genders match
        if (user.gender !== post.gender) {
          return res
            .status(403)
            .json({ error: "Access denied due to gender mismatch" });
        }

        // Find the info of the user whose id is equal to posted_by of the post
        db.query(
          "SELECT * FROM users WHERE studentId = ?",
          [post.posted_by],
          (err, contactResult) => {
            if (err) {
              console.error("Error fetching contact info:", err);
              return res.status(400).json({ error: err });
            }

            if (contactResult.length === 0) {
              return res.status(404).json({ error: "Contact user not found" });
            }

            const contactUser = contactResult[0];
            return res.json({
              name: contactUser.name,
              email: contactUser.email,
              studentId: contactUser.studentId,
            });
          }
        );
      });
    }
  );
};

// ROUTES
// GET All users
router.get("/", authenticateToken, allUsers);

// POST register user
router.post("/register", upload.single("idCard"), registerUser);

// POST login user
router.post("/login", loginUser);

// GET user by token (self)
router.get("/self", authenticateToken, selfData);

// Approve user by ID
router.get("/approve/:id", authenticateToken, approveUser);

// Delete user by ID
router.delete("/delete/:id", authenticateToken, deleteUser);

// Ban user by ID
router.get("/ban/:id", authenticateToken, banUser);

// Make admin by ID
router.get("/makeadmin/:id", authenticateToken, makeAdmin);

// Update user
router.put("/update", authenticateToken, updateUser);

// GET contact info
router.get("/contact/:id", authenticateToken, getContact);

export default router;
