const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Load data from files with error handling
let users = [];
let questions = [];
let exams = [];
let results = [];

try {
  users = JSON.parse(fs.readFileSync('users.json'));
  questions = JSON.parse(fs.readFileSync('questions.json'));
  exams = JSON.parse(fs.readFileSync('exams.json', 'utf8') || '[]');
  results = JSON.parse(fs.readFileSync('results.json', 'utf8') || '[]');
} catch (error) {
  console.error('Error loading data files:', error);
}

// Save data to files with error handling
function saveData() {
  try {
    fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
    fs.writeFileSync('questions.json', JSON.stringify(questions, null, 2));
    fs.writeFileSync('exams.json', JSON.stringify(exams, null, 2));
    fs.writeFileSync('results.json', JSON.stringify(results, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    return false;
  }
}

// Login endpoint with validation
app.post('/login', (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    // Validate input
    if (!username || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username, password, and role are required' 
      });
    }
    
    const user = users.find(u => 
      u.username === username && 
      u.password === password && 
      u.role === role
    );
    
    if (user) {
      // Don't send password back to client
      res.json({ 
        success: true, 
        name: user.name,
        username: user.username,
        role: user.role
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

// Get all users
app.get('/users', (req, res) => {
  if (req.query.role) {
    res.json(users.filter(u => u.role === req.query.role));
  } else {
    res.json(users);
  }
});

// Get single user
app.get('/users/:username', (req, res) => {
  try {
    const user = users.find(u => u.username === req.params.username);
    if (user) {
      // Don't send password back to client
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reset password endpoint
app.post('/reset-password', (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username, current password, and new password are required' 
      });
    }
    
    const userIndex = users.findIndex(u => u.username === username && u.password === currentPassword);
    
    if (userIndex === -1) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Update password
    users[userIndex].password = newPassword;
    
    // Save changes
    if (saveData()) {
      res.json({ success: true, message: 'Password updated successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to update password' });
    }
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add student endpoint with enhanced validation
app.post('/add-student', (req, res) => {
  try {
    const { username, password, name, email } = req.body;
    
    // Validate required fields
    if (!username || !password || !name) {
      return res.status(400).json({ 
        success: false, 
        message: "Please fill in all required fields" 
      });
    }
    
    // Validate username format (alphanumeric)
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return res.status(400).json({ 
        success: false, 
        message: "Username must contain only letters and numbers" 
      });
    }
    
    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: "Password must be at least 6 characters long" 
      });
    }
    
    // Check if username already exists
    if (users.some(u => u.username === username)) {
      return res.status(409).json({ 
        success: false, 
        message: "Username already exists" 
      });
    }
    
    // Create new student
    const newStudent = {
      username,
      password,
      name,
      role: "student",
      email: email || "",
      createdAt: new Date().toISOString()
    };
    
    users.push(newStudent);
    
    // Save data
    if (saveData()) {
      // Return success without password
      const { password, ...studentWithoutPassword } = newStudent;
      res.status(201).json({ 
        success: true, 
        message: "Student added successfully",
        student: studentWithoutPassword
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: "Failed to save student data" 
      });
    }
  } catch (error) {
    console.error('Error adding student:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while adding student" 
    });
  }
});

// Delete user with improved error handling
app.delete('/users/:username', (req, res) => {
  try {
    const username = req.params.username;
    
    // Prevent deletion of admin user
    if (username === 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Cannot delete admin user" 
      });
    }
    
    const index = users.findIndex(u => u.username === username);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }
    
    // Check if user has exam results before deletion
    const userResults = results.filter(r => r.studentId === username);
    
    // Delete user
    const deletedUser = users.splice(index, 1)[0];
    
    // Save changes
    if (saveData()) {
      res.json({ 
        success: true, 
        message: "User deleted successfully",
        resultsAffected: userResults.length
      });
    } else {
      // Restore user if save failed
      users.splice(index, 0, deletedUser);
      res.status(500).json({ 
        success: false, 
        message: "Failed to delete user" 
      });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while deleting user" 
    });
  }
});

// Get questions endpoint
app.get('/questions', (req, res) => {
  res.json(questions);
});

// Get single question
app.get('/questions/:id', (req, res) => {
  const question = questions.find(q => q.id == req.params.id);
  if (question) {
    res.json(question);
  } else {
    res.status(404).json({ error: 'Question not found' });
  }
});

// Add question endpoint
app.post('/questions', (req, res) => {
  const question = req.body;
  // Assign new ID if not provided
  if (!question.id) {
    question.id = questions.length > 0 ? Math.max(...questions.map(q => q.id)) + 1 : 1;
  }
  questions.push(question);
  saveData();
  res.json({ success: true });
});

// Update question
app.put('/questions/:id', (req, res) => {
  const index = questions.findIndex(q => q.id == req.params.id);
  if (index !== -1) {
    questions[index] = req.body;
    saveData();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false });
  }
});

// Delete question
app.delete('/questions/:id', (req, res) => {
  const index = questions.findIndex(q => q.id == req.params.id);
  if (index !== -1) {
    questions.splice(index, 1);
    saveData();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false });
  }
});

// Get single exam
app.get('/exam/:id', (req, res) => {
  console.log('Fetching exam with ID:', req.params.id, 'Type:', typeof req.params.id);
  console.log('Available exam IDs:', exams.map(e => ({ id: e.id, type: typeof e.id })));
  
  // Ensure string comparison for IDs
  const exam = exams.find(e => String(e.id) === String(req.params.id));
  
  if (exam) {
    console.log('Exam found:', exam.title, 'with ID:', exam.id);
    res.json(exam);
  } else {
    console.log('Exam not found for ID:', req.params.id);
    res.status(404).json({ success: false, message: 'Exam not found' });
  }
});

// Get exam questions
app.get('/exam/:id/questions', (req, res) => {
  try {
    console.log('Fetching questions for exam ID:', req.params.id);
    console.log('Available exams:', exams.map(e => ({ id: e.id, title: e.title })));
    
    const exam = exams.find(e => String(e.id) === String(req.params.id));
    
    if (!exam) {
      console.log('Exam not found for questions, ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    
    console.log('Found exam for questions:', exam.title, 'with question IDs:', exam.questionIds);
    console.log('Available questions:', questions.map(q => ({ id: q.id, question: q.question.substring(0, 20) + '...' })));
    
    // Get questions for this exam
    const examQuestions = exam.questionIds.map(qId => {
      console.log('Looking for question with ID:', qId, 'type:', typeof qId);
      const question = questions.find(q => Number(q.id) === Number(qId));
      
      if (question) {
        console.log('Found question:', question.question.substring(0, 20) + '...');
        // Return a copy without the correct answer for security
        const { answer, ...questionWithoutAnswer } = question;
        return questionWithoutAnswer;
      }
      console.log('Question not found for ID:', qId, 'Available IDs:', questions.map(q => q.id));
      return null;
    }).filter(q => q !== null);
    
    console.log(`Found ${examQuestions.length} questions for exam`);
    console.log('Questions being sent:', examQuestions.map(q => ({ id: q.id, question: q.question.substring(0, 20) + '...' })));
    
    res.json({
      success: true,
      examId: exam.id,
      title: exam.title,
      questions: examQuestions
    });
  } catch (error) {
    console.error('Error fetching exam questions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all exams
app.get('/exams', (req, res) => {
  res.json(exams);
});

// Add exam endpoint with enhanced validation
app.post('/add-exam', (req, res) => {
  try {
    const { title, duration, questionIds, startDate, endDate, description } = req.body;
    
    // Validate required fields
    if (!title || !duration || !questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing or invalid required fields" 
      });
    }
    
    // Validate duration is a positive number
    const durationNum = Number(duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Duration must be a positive number" 
      });
    }
    
    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid date format" 
        });
      }
      
      if (start >= end) {
        return res.status(400).json({ 
          success: false, 
          message: "End date must be after start date" 
        });
      }
    }
    
    // Convert questionIds to numbers and validate they exist
    const processedQuestionIds = questionIds.map(id => Number(id));
    const invalidQuestions = processedQuestionIds.filter(id => 
      !questions.some(q => q.id === id)
    );
    
    if (invalidQuestions.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Questions with IDs ${invalidQuestions.join(', ')} do not exist` 
      });
    }
    
    // Create unique ID
    const examId = `exam${Date.now().toString().slice(-6)}`;
    
    // Create new exam
    const newExam = {
      id: examId,
      title,
      duration: durationNum,
      questionIds: processedQuestionIds,
      active: true,
      startDate: startDate || null,
      endDate: endDate || null,
      description: description || "",
      createdAt: new Date().toISOString()
    };
    
    exams.push(newExam);
    
    // Save data
    if (saveData()) {
      res.status(201).json({ 
        success: true, 
        message: "Exam created successfully",
        exam: newExam
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: "Failed to save exam data" 
      });
    }
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while creating exam" 
    });
  }
});

// Update exam status
app.put('/exam/:id/status', (req, res) => {
  const exam = exams.find(e => e.id === req.params.id);
  if (exam) {
    exam.active = req.body.active;
    saveData();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: 'Exam not found' });
  }
});

// Update exam
app.put('/exams', (req, res) => {
  try {
    const { id, title, duration, description, questionIds, startDate, endDate } = req.body;
    
    // Validate required fields
    if (!id || !title || !duration || !questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID, title, duration, and questionIds are required' 
      });
    }
    
    // Find the exam index
    const examIndex = exams.findIndex(e => e.id === id);
    if (examIndex === -1) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    
    // Update exam data
    exams[examIndex] = {
      ...exams[examIndex],
      title,
      duration: parseInt(duration),
      description: description || '',
      questionIds: questionIds.map(id => parseInt(id)),
      startDate: startDate || null,
      endDate: endDate || null,
      updatedAt: new Date().toISOString()
    };
    
    // Save to file
    if (saveData()) {
      res.json({ 
        success: true, 
        message: 'Exam updated successfully',
        exam: exams[examIndex]
      });
    } else {
      throw new Error('Failed to save exam data');
    }
  } catch (error) {
    console.error('Error updating exam:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating exam',
      error: error.message 
    });
  }
});

// Delete exam
app.delete('/exam/:id', (req, res) => {
  const index = exams.findIndex(e => e.id === req.params.id);
  if (index !== -1) {
    exams.splice(index, 1);
    saveData();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false });
  }
});

// Submit exam endpoint with enhanced validation and scoring
app.post('/submit', (req, res) => {
  try {
    const { answers, examId, username, timeSpent } = req.body;
    const user = username || req.query.user;
    
    // Validate required fields
    if (!answers || !examId || !user) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }
    
    // Validate exam exists
    const exam = exams.find(e => e.id === examId);
    if (!exam) {
      return res.status(404).json({ 
        success: false, 
        message: "Exam not found" 
      });
    }
    
    // Validate exam is active
    if (!exam.active) {
      return res.status(403).json({ 
        success: false, 
        message: "This exam is no longer active" 
      });
    }
    
    // Validate date range if specified
    if (exam.startDate && exam.endDate) {
      const now = new Date();
      const start = new Date(exam.startDate);
      const end = new Date(exam.endDate);
      
      if (now < start || now > end) {
        return res.status(403).json({ 
          success: false, 
          message: "This exam is not available at this time" 
        });
      }
    }
    
    // Validate user exists
    const userExists = users.some(u => u.username === user);
    if (!userExists) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }
    
    // Get exam questions
    const examQuestions = questions.filter(q => exam.questionIds.includes(q.id));
    
    // Validate answers array length
    if (answers.length !== examQuestions.length) {
      return res.status(400).json({ 
        success: false, 
        message: "Number of answers does not match number of questions" 
      });
    }
    
    // Calculate score
    let score = 0;
    const detailedResults = examQuestions.map((question, i) => {
      const isCorrect = answers[i] === question.answer;
      if (isCorrect) score++;
      
      return {
        questionId: question.id,
        question: question.question,
        userAnswer: answers[i],
        correctAnswer: question.answer,
        isCorrect
      };
    });
    
    const percentage = Math.round((score / examQuestions.length) * 100);
    
    // Create result object
    const resultObj = {
      studentId: user,
      examId,
      score: percentage,
      date: new Date().toISOString(),
      answers,
      timeSpent: timeSpent || null,
      detailedResults
    };
    
    results.push(resultObj);
    
    // Save data
    if (saveData()) {
      res.json({ 
        success: true,
        score: percentage,
        correct: score,
        total: examQuestions.length,
        message: "Exam submitted successfully"
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: "Failed to save exam results" 
      });
    }
  } catch (error) {
    console.error('Error submitting exam:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while submitting exam" 
    });
  }
});

// Get results with improved filtering
app.get('/results', (req, res) => {
  try {
    let filteredResults = [...results];
    
    // Filter by student ID
    if (req.query.studentId) {
      filteredResults = filteredResults.filter(r => r.studentId === req.query.studentId);
    }
    
    // Filter by exam ID
    if (req.query.examId) {
      filteredResults = filteredResults.filter(r => r.examId === req.query.examId);
    }
    
    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(req.query.endDate);
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        filteredResults = filteredResults.filter(r => {
          const resultDate = new Date(r.date);
          return resultDate >= startDate && resultDate <= endDate;
        });
      }
    }
    
    // Filter by minimum score
    if (req.query.minScore) {
      const minScore = Number(req.query.minScore);
      if (!isNaN(minScore)) {
        filteredResults = filteredResults.filter(r => r.score >= minScore);
      }
    }
    
    // Sort results
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'date':
          filteredResults.sort((a, b) => new Date(b.date) - new Date(a.date));
          break;
        case 'score':
          filteredResults.sort((a, b) => b.score - a.score);
          break;
      }
    }
    
    // Limit results
    if (req.query.limit) {
      const limit = Number(req.query.limit);
      if (!isNaN(limit) && limit > 0) {
        filteredResults = filteredResults.slice(0, limit);
      }
    }
    
    res.json(filteredResults);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while fetching results" 
    });
  }
});

// Analytics endpoint for administrators
app.get('/analytics', (req, res) => {
  try {
    // Validate admin access (in a real app, this would use proper authentication)
    const { role } = req.query;
    if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Unauthorized access" 
      });
    }
    
    // Calculate overall statistics
    const totalStudents = users.filter(u => u.role === 'student').length;
    const totalExams = exams.length;
    const activeExams = exams.filter(e => e.active).length;
    const totalResults = results.length;
    
    // Calculate average scores
    const validScores = results.filter(r => r.score !== null).map(r => r.score);
    const avgScore = validScores.length > 0 
      ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length) 
      : 0;
    
    // Get top performing students
    const studentPerformance = {};
    results.forEach(result => {
      if (result.score === null) return;
      
      if (!studentPerformance[result.studentId]) {
        studentPerformance[result.studentId] = {
          totalScore: 0,
          count: 0,
          scores: []
        };
      }
      
      studentPerformance[result.studentId].totalScore += result.score;
      studentPerformance[result.studentId].count += 1;
      studentPerformance[result.studentId].scores.push(result.score);
    });
    
    const studentAverages = Object.keys(studentPerformance).map(studentId => {
      const student = users.find(u => u.username === studentId);
      const perf = studentPerformance[studentId];
      return {
        studentId,
        name: student ? student.name : 'Unknown',
        averageScore: Math.round(perf.totalScore / perf.count),
        examsTaken: perf.count,
        highestScore: Math.max(...perf.scores),
        lowestScore: Math.min(...perf.scores)
      };
    }).sort((a, b) => b.averageScore - a.averageScore);
    
    // Get exam statistics
    const examStats = exams.map(exam => {
      const examResults = results.filter(r => r.examId === exam.id && r.score !== null);
      const scores = examResults.map(r => r.score);
      
      return {
        examId: exam.id,
        title: exam.title,
        averageScore: scores.length > 0 
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) 
          : 0,
        highestScore: scores.length > 0 ? Math.max(...scores) : 0,
        lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
        participants: examResults.length,
        active: exam.active
      };
    }).sort((a, b) => b.participants - a.participants);
    
    // Return analytics data
    res.json({
      success: true,
      overview: {
        totalStudents,
        totalExams,
        activeExams,
        totalResults,
        averageScore: avgScore
      },
      topStudents: studentAverages.slice(0, 5),
      examStatistics: examStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while generating analytics" 
    });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));