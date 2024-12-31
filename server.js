import express from "express";
import dotenv from "dotenv";
import mysql from "mysql";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import userController from "./controllers/userController.js";
import postController from "./controllers/postController.js";

dotenv.config();
const PORT = process.env.PORT || 5001;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database Connection
export const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "bachelor_point",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    process.exit(1);
  }
  console.log("Connected to the database");
});

// Middleware
// app.use(express.json());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);
app.use(
  "/uploads",
  express.static(path.join(__dirname, "controllers", "uploads"))
);
app.use("/dp", express.static(path.join(__dirname, "controllers", "dp")));
app.use("/posts", express.static(path.join(__dirname, "controllers", "posts")));

// Routes
app.use("/api/users", userController);
app.use("/api/posts", postController);

// Server
app.listen(PORT, () => console.log(`Server is running at port ${PORT}`));
