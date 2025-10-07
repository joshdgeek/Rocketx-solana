const express = require("express");
const routes = require("./solana/routes/route");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors());
app.use(routes);

const port = 5000;
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});