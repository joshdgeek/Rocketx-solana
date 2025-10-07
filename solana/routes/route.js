const { Router } = require("express");
const { transfer } = require("../transferLogic.js");
const router = Router();

router.post("/", transfer);

module.exports = router;