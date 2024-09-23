const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));

const profileRouter = require('./routes/profile');
const postRouter = require('./routes/post');

app.use('/api/profile', profileRouter);
app.use('/api/post', postRouter);
app.get("/", (req, res) => res.send("Express on Vercel"));

app.listen(8080, () => {
    console.log("AI Agent Running on port : 8080")
})