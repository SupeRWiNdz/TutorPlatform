const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const classRoutes = require('./routes/classRoutes');

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.use('/', userRoutes);
app.use('/', messageRoutes);
app.use('/', classRoutes);

module.exports = { app };