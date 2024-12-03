import express from "express";
import dotenv from "dotenv";
// const dbConnect = require("./database/dbConnect");
import cors from "cors";
// const errorHandler = require("./middleware/errorHandler");

// const taskRoutes = require("./routes/taskRoutes");
// const adminRoutes = require("./routes/adminRoutes");
// const projectRoutes = require("./routes/projectRoutes");
// const employeeRoutes = require("./routes/employeeRoutes");

dotenv.config();
const PORT = process.env.PORT || 5001;
const app = express();
// dbConnect();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

// Routes
// app.use("/api/tasks", taskRoutes);
// app.use("/api/admins", adminRoutes);
// app.use("/api/employees", employeeRoutes);
// app.use("/api/projects", projectRoutes);

// Error Middleware
// app.use(errorHandler);

app.listen(PORT, () => console.log(`Server is running at port ${PORT}`));
