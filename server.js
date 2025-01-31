const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./Db'); // Assuming your User model is defined in Db.js
const session = require('express-session');
const nodemailer = require('nodemailer'); // Import nodemailer
require('dotenv').config(); // To load environment variables from a .env file
const multer = require('multer');

const app = express();
const port = process.env.PORT || 5000;

// Load environment variables
const jwtSecret = process.env.JWT_SECRET;
// const mongoURI = process.env.MONGODB_URI ;

let corsOptions = {
  origin: ["https://679cdb670057a200884e63ba--gentle-paletas-c5fe54.netlify.app"],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(session({ secret: 'your_session_secret', resave: false, saveUninitialized: true }));

// Initialize Passport.js
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
mongoose.connect("mongodb+srv://p14222901:dkQhQnzN3DYkv6lC@cluster0.6t5al.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.error('MongoDB connection error:', error));

// Set up Nodemailer for sending emails
const transporter = nodemailer.createTransport({
    service: 'Gmail', // Use Gmail or any email service
    auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS  // Your email password or app password
    }
});

// Passport Google OAuth configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            user = new User({
                googleId: profile.id,
                username: profile.displayName,
                email: profile.emails[0].value
            });
            await user.save();
        }
        done(null, user);
    } catch (error) {
        done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Signup route
app.post("/signup", async (req, res) => {
    try {
        const { username, password, email, phone } = req.body;
        // const existingUsername = await User.findOne({ username });
        // if (existingUsername) return res.status(400).json({ message: "Username already exists." });

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "User with this email already exists." });

        const hashedPassword = await bcrypt.hash(password, 5);
        const newUser = new User({
            username,
            password: hashedPassword,
            email,
            phone
        });
        await newUser.save();

        const token = jwt.sign({ email: newUser.email }, jwtSecret, { expiresIn: '1h' });
        res.status(201).json({ token, message: "User created successfully!" });
       
    } catch (error) {
        res.status(500).json({ message: "Error creating user: " + error.message });
    }
});

// Login route with JWT
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(400).json({ message: "Incorrect password" });

        const token = jwt.sign({ email: user.email }, jwtSecret, { expiresIn: '1h' });
        res.status(200).json({ token });
    } catch (error) {
        res.status(500).json({ message: "Error logging in: " + error.message });
    }
});

// Google OAuth Login
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth Callback Route
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        const token = jwt.sign({ email: req.user.email }, jwtSecret, { expiresIn: '1h' });
        res.redirect(`http://localhost:3000/home?token=${token}`);
    }
);

// Forgot password route
app.post("/forgotpassword", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        // Create a reset token valid for 15 minutes
        const resetToken = jwt.sign({ email: user.email }, jwtSecret, { expiresIn: '15m' });

        // Prepare the email content
        
        const resetUrl = `http://localhost:3000/resetpassword?token=${resetToken}`;
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Please click the link to reset your password: ${resetUrl}`
        };

        // Send the email
        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "Password reset link has been sent to your email." });
    } catch (error) {
        res.status(500).json({ message: "Error processing request: " + error.message });
    }
});

// Middleware to protect routes (JWT verification)
const authenticateToken = (req, res, next) => { 
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) return res.status(403).send("Token required");

    jwt.verify(token, jwtSecret, (err, user) => {
        if (err) return res.status(403).send("Invalid token");
        req.user = user;
        next();
    });
};

// Protected home route
app.get("/home", authenticateToken, (req, res) => {
    res.status(200).send(`Welcome to the home page, ${req.user.email}!`);
});




app.get('/', (req, res) => {
  return res.send('Client-Developer Platform Backend');
    
  });
  
  // Example API route
  app.get('/projects', (req, res) => {
    return res.json([
       { id: 1, name: 'Project A', status: 'In Progress' },
       { id: 2, name: 'Project B', status: 'Completed' },
       { id: 3, name: 'Project C', status: 'Delayed' }
     ]);
   });
  
   app.get('/consultations', (req, res) => {
    return res.json([
       { id: 1, date: '2024-10-20', time: '10:00 AM', description: 'Project discussion for mobile app development.' },
       { id: 2, date: '2024-10-21', time: '2:00 PM', description: 'Backend architecture meeting.' }
     ]);
   });
   
   // Add new consultation
   app.post('/consultations', (req, res) => {
     const newConsultation = {
       id: Math.floor(Math.random() * 1000),
       date: req.body.date,
       time: req.body.time,
       description: req.body.description
     };
     return res.status(201).json(newConsultation);
   });
  
  
  
  // Mock data for conversations
  const conversations = [
    {
      id: 1,
      projectName: 'Mobile App Development',
      messages: [
        { sender: 'client', content: 'Hi, how is the project going?' },
        { sender: 'developer', content: 'It’s going well, we’re on track!' }
      ],
    },
    {
      id: 2,
      projectName: 'Website Redesign',
      messages: [
        { sender: 'client', content: 'Can you update the design by tomorrow?' },
        { sender: 'developer', content: 'Sure, I will work on it!' }
      ],
    }
  ];

  // Define a schema and model
const ProjectScopeSchema = new mongoose.Schema({
  deliverables: String,
  timelines: String,
  budget: Number,
  riskManagement: String,
  approvalWorkflow: String,
});

const ProjectScope = mongoose.model('ProjectScope', ProjectScopeSchema);

// Route to save project scope data
app.post('/api/project-scope', async (req, res) => {
  try {
    const projectScope = new ProjectScope(req.body);
    await projectScope.save();
    return res.status(201).json({ message: 'Project Scope saved successfully!' });
  } catch (error) {
    console.error('Error saving project scope:', error);
    res.status(500).json({ message: 'Error saving project scope' });
  }
});
  
  // Get conversations
  app.get('/conversations', (req, res) => {
    return res.json(conversations);
  });
  
  // Send message (for simplicity, we update the data in-memory, replace this with a real DB)
  app.post('/conversations/:id/messages', (req, res) => {
    const { id } = req.params;
    const { sender, content } = req.body;
  
    const conversation = conversations.find((conv) => conv.id === parseInt(id));
    if (conversation) {
      conversation.messages.push({ sender, content });
      return  res.status(200).json(conversation);
    } else {
      return res.status(404).json({ message: 'Conversation not found' });
    }
  });


// Middleware file
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded files

// Define Schema and Model
const fileSchema = new mongoose.Schema({
  filename: String,
  filepath: String,
  filetype: String,
  date: { type: Date, default: Date.now }
});

const File = mongoose.model('File', fileSchema);

// Setup Multer for File Uploads
const storage = multer.diskStorage({
  destination: './uploads/', // Directory to save files
  filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// API Endpoint to Upload File
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
      const file = new File({
          filename: req.file.filename,
          filepath: req.file.path,
          filetype: req.file.mimetype
      });

      const savedFile = await file.save();
      return res.status(201).json({ message: 'File uploaded successfully', file: savedFile });
  } catch (err) {
    return res.status(500).json({ error: 'File upload failed', details: err.message });
  }
});

// API to Get Uploaded Files

app.get('/files', async (req, res) => {
  try {
      const files = await File.find();
      return  res.status(200).json(files);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
  