import express from "express";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { fileURLToPath } from "url";
import multer from "multer";
import authenticateToken from "../middleware/authenticateToken.js";
import { db } from "../server.js";
import { error } from "console";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

const writeFile = promisify(fs.writeFile);

// CONTROLLER FUNCTIONS
// Add post
const addPost = async (req, res) => {
  const { title, description, available_from, gender, rent, location, images } =
    req.body;
  const { studentId } = req.user;

  if (req.user.status === "not approved") {
    return res.status(400).json({ error: "Your account is not approved yet!" });
  }

  if (
    !title ||
    !description ||
    !available_from ||
    !gender ||
    !rent ||
    !location ||
    !images ||
    !Array.isArray(images)
  ) {
    return res.status(400).json({ error: "All fields are required!" });
  }

  try {
    const imagePaths = [];

    for (const base64Image of images) {
      // Decode base64 image and save it to the filesystem
      const imageBuffer = Buffer.from(
        base64Image.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );
      const imagePath = path.join(
        __dirname,
        "posts",
        `${Date.now()}-${Math.random().toString(36).substring(7)}.png`
      );

      // Ensure the uploads directory exists
      const uploadsDir = path.join(__dirname, "posts");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }

      // Write the file to the filesystem
      await writeFile(imagePath, imageBuffer);

      // Store the relative path of the image
      const relativeImagePath = `posts/${path.basename(imagePath)}`;
      imagePaths.push(relativeImagePath);
    }

    // Store post data in the database, including the image paths
    db.query(
      "INSERT INTO posts (title, description, available_from, gender, rent, location, images, posted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        title,
        description,
        available_from,
        gender,
        rent,
        location,
        JSON.stringify(imagePaths),
        studentId,
      ],
      (err, result) => {
        if (err) {
          console.error("Error inserting post:", err);
          return res.status(400).json({ error: err });
        }
        console.log("Post added successfully:", result);
        return res.json({ message: "Post added successfully" });
      }
    );
  } catch (err) {
    console.error("Error processing images:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get all posts
const getPosts = (req, res) => {
  if (req.user.status === "not approved") {
    return res.status(400).json({ error: "Your account is not approved yet!" });
  }

  db.query("SELECT * FROM posts", (err, result) => {
    if (err) {
      console.error("Error fetching posts:", err);
      return res.status(400).json({ error: err });
    }
    return res.json(result);
  });
};

// Get post by ID
const getPostById = (req, res) => {
  const { id } = req.params;

  if (req.user.status === "not approved") {
    return res.status(400).json({ error: "Your account is not approved yet!" });
  }

  db.query("SELECT * FROM posts WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("Error fetching post:", err);
      return res.status(400).json({ error: err });
    }
    return res.json(result[0]);
  });
};

// Get own posts
const getOwnPost = (req, res) => {
  const { studentId } = req.user;

  if (req.user.status === "not approved") {
    return res.status(400).json({ error: "Your account is not approved yet!" });
  }

  db.query(
    "SELECT * FROM posts WHERE posted_by = ?",
    [studentId],
    (err, result) => {
      if (err) {
        console.error("Error fetching post:", err);
        return res.status(400).json({ error: err });
      }
      return res.json(result);
    }
  );
};

// DELETE post
const deletePost = (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM posts WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("Error deleting post:", err);
      return res.status(400).json({ error: err });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.json({ message: "Post deleted successfully" });
  });
};

// Update post
const updatePost = async (req, res) => {
  const { title, description, available_from, gender, rent, location, images } =
    req.body;
  const { studentId } = req.user;

  if (
    !title ||
    !description ||
    !available_from ||
    !gender ||
    !rent ||
    !location ||
    !images ||
    !Array.isArray(images)
  ) {
    console.log("error");
    return res.status(400).json({ error: "All fields are required!" });
  }

  try {
    const imagePaths = [];

    for (const image of images) {
      if (image.startsWith("data:image/")) {
        // Handle base64 image
        const imageBuffer = Buffer.from(
          image.replace(/^data:image\/\w+;base64,/, ""),
          "base64"
        );
        const imagePath = path.join(
          __dirname,
          "posts",
          `${Date.now()}-${Math.random().toString(36).substring(7)}.png`
        );

        // Ensure the uploads directory exists
        const uploadsDir = path.join(__dirname, "posts");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir);
        }

        // Write the file to the filesystem
        await writeFile(imagePath, imageBuffer);

        // Store the relative path of the image
        const relativeImagePath = `posts/${path.basename(imagePath)}`;
        imagePaths.push(relativeImagePath);
      } else {
        // Handle relative path (existing image)
        imagePaths.push(image);
      }
    }

    // Store post data in the database, including the image paths
    const { id } = req.params;

    db.query(
      "UPDATE posts SET title = ?, description = ?, available_from = ?, gender = ?, rent = ?, location = ?, images = ? WHERE id = ? AND posted_by = ?",
      [
        title,
        description,
        available_from,
        gender,
        rent,
        location,
        JSON.stringify(imagePaths),
        id,
        studentId,
      ],
      (err, result) => {
        if (err) {
          console.error("Error updating post:", err);
          return res.status(400).json({ error: err });
        }
        if (result.affectedRows === 0) {
          return res
            .status(404)
            .json({ error: "Post not found or not authorized" });
        }
        console.log("Post updated successfully:", result);
        return res.json({ message: "Post updated successfully" });
      }
    );
  } catch (err) {
    console.error("Error processing images:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ROUTES
// Add post
router.post("/add", authenticateToken, addPost);

// GET All posts
router.get("/all", authenticateToken, getPosts);

// GET own posts
router.get("/self", authenticateToken, getOwnPost);

// UPDATE post
router.put("/update/:id", authenticateToken, updatePost);

// GET post by ID
router.get("/:id", authenticateToken, getPostById);

// Delete post
router.delete("/:id", authenticateToken, deletePost);

export default router;
