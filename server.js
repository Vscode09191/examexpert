const express = require('express');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();

app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

// File path for the local database
const DATA_FILE = './data.json';

// Initialize data file if it doesn't exist
async function initializeDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch (err) {
        await fs.writeFile(DATA_FILE, JSON.stringify({ users: [], questions: [], responses: [] }, null, 2));
    }
}

// Read data from file
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading data file:', err);
        throw err;
    }
}

// Write data to file
async function writeData(data) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error writing to data file:', err);
        throw err;
    }
}

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(token, 'secret_key');
        req.user = decoded;
        next();
    } catch (err) {
        console.log('Invalid token:', err.message);
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Routes
app.post('/api/auth/login', async (req, res) => {
    const { email, password, isAdmin } = req.body;
    console.log('Login attempt:', { email, isAdmin });
    try {
        const data = await readData();
        const user = data.users.find(user => user.email === email);
        if (!user) {
            console.log('User not found:', email);
            return res.status(400).json({ message: 'User not found' });
        }
        if (user.isAdmin !== isAdmin) {
            console.log('Invalid user type:', { email, isAdmin });
            return res.status(400).json({ message: 'Invalid user type' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Invalid credentials for:', email);
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id, isAdmin: user.isAdmin }, 'secret_key', { expiresIn: '1h' });
        console.log('Login successful:', { userId: user.id, isAdmin });
        res.json({ token, userId: user.id });
    } catch (err) {
        console.error('Login server error:', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.post('/api/questions', authMiddleware, async (req, res) => {
    if (!req.user.isAdmin) {
        console.log('Admin access required:', req.user);
        return res.status(403).json({ message: 'Admin access required' });
    }
    const { text, options, correctOption } = req.body;
    try {
        const data = await readData();
        const question = { id: data.questions.length + 1, text, options, correctOption };
        data.questions.push(question);
        await writeData(data);
        console.log('Question added:', question);
        res.status(201).json({ message: 'Question added' });
    } catch (err) {
        console.error('Error adding question:', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.get('/api/questions', authMiddleware, async (req, res) => {
    if (!req.user.isAdmin) {
        console.log('Admin access required for questions:', req.user);
        return res.status(403).json({ message: 'Admin access required' });
    }
    try {
        const data = await readData();
        res.json(data.questions);
    } catch (err) {
        console.error('Error fetching questions:', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.get('/api/questions/:id', authMiddleware, async (req, res) => {
    try {
        const data = await readData();
        const question = data.questions.find(q => q.id === parseInt(req.params.id));
        if (!question) {
            console.log('Question not found:', req.params.id);
            return res.status(404).json({ message: 'Question not found' });
        }
        res.json(question);
    } catch (err) {
        console.error('Error fetching question:', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.post('/api/responses', authMiddleware, async (req, res) => {
    const { userId, answers, score } = req.body;
    try {
        const data = await readData();
        data.responses.push({ userId, answers, score, timestamp: new Date() });
        await writeData(data);
        console.log('Responses saved for user:', userId);
        res.status(201).json({ message: 'Responses saved' });
    } catch (err) {
        console.error('Error saving responses:', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.get('/api/responses', authMiddleware, async (req, res) => {
    if (!req.user.isAdmin) {
        console.log('Admin access required for responses:', req.user);
        return res.status(403).json({ message: 'Admin access required' });
    }
    try {
        const data = await readData();
        res.json(data.responses);
    } catch (err) {
        console.error('Error fetching responses:', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.listen(3000, async () => {
    await initializeDataFile();
    console.log('Server running on port 3000');
});