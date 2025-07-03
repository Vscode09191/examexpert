const express = require('express');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// File path for the local database
const DATA_FILE = './data.json';

// Initialize data file if it doesn't exist
async function initializeDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch (err) {
        await fs.writeFile(DATA_FILE, JSON.stringify({ users: [], questions: [] }, null, 2));
    }
}

// Read data from file
async function readData() {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

// Write data to file
async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
        const decoded = jwt.verify(token, 'secret_key');
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Routes
app.post('/api/auth/signup', async (req, res) => {
    const { email, password, isAdmin } = req.body;
    try {
        const data = await readData();
        const existingUser = data.users.find(user => user.email === email);
        if (existingUser) return res.status(400).json({ message: 'User already exists' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = { id: Date.now().toString(), email, password: hashedPassword, isAdmin };
        data.users.push(user);
        await writeData(data);
        res.status(201).json({ message: 'User created' });
    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password, isAdmin } = req.body;
    try {
        const data = await readData();
        const user = data.users.find(user => user.email === email);
        if (!user) return res.status(400).json({ message: 'User not found' });
        if (user.isAdmin !== isAdmin) return res.status(400).json({ message: 'Invalid user type' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id, isAdmin: user.isAdmin }, 'secret_key', { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.post('/api/questions', authMiddleware, async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });
    const { text, options, correctOption } = req.body;
    try {
        const data = await readData();
        const question = { id: data.questions.length + 1, text, options, correctOption };
        data.questions.push(question);
        await writeData(data);
        res.status(201).json({ message: 'Question added' });
    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.get('/api/questions', authMiddleware, async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });
    try {
        const data = await readData();
        res.json(data.questions);
    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.get('/api/questions/:id', authMiddleware, async (req, res) => {
    try {
        const data = await readData();
        const question = data.questions.find(q => q.id === parseInt(req.params.id));
        if (!question) return res.status(404).json({ message: 'Question not found' });
        res.json(question);
    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.listen(3000, async () => {
    await initializeDataFile();
    console.log('Server running on port 3000');
});