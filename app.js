const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("./db");
// Routes
const userRouter = require("./routes/user");
const actorRouter = require("./routes/actor");
const movieRouter = require("./routes/movie");
const reviewRouter = require("./routes/review");
const adminRouter = require("./routes/admin");
// Helpers
const { handleNotFound } = require("./utils/helper");

const app = express();

app.use(express.json());
app.use(cors());

app.use("/api/user", userRouter);
app.use("/api/actor", actorRouter);
app.use("/api/movie", movieRouter);
app.use("/api/review", reviewRouter);
app.use("/api/admin", adminRouter);

app.use("/*", handleNotFound);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log("Server is Running " + PORT);
});
