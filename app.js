// Import necessary modules
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB with mongoose (using environment variables)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));


// Middleware setup
app.set('view engine', 'ejs');  // Set view engine to EJS
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded requests
app.use(express.json());  // Parse JSON requests

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'defaultsecret', // Use environment variable for session secret
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Nodemailer configuration with environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // Gmail user from .env
    pass: process.env.GMAIL_PASS, // Gmail app password from .env
  },
});

// Route to render the services page
app.get('/services', (req, res) => {
  res.render('services');  // Ensure 'services.ejs' is in the 'views' folder
});

// Route to handle contact form submissions
app.post('/submit-contact', (req, res) => {
  const { name, contact, email, message } = req.body;

  // Validate required fields
  if (!name || !contact || !email || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.GMAIL_USER,  // Send email to yourself (or change to desired recipient)
    subject: 'New Contact Form Submission',
    text: `Name: ${name}\nContact: ${contact}\nEmail: ${email}\nMessage: ${message}`,
  };

  // Send the email
  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error while sending email:', err);
      return res.status(500).json({ success: false, message: 'An error occurred while sending the email' });
    }
    console.log('Email sent:', info.response);
    res.status(200).json({ success: true, message: 'Email sent successfully' });
  });
});

// Import and use authentication routes (ensure auth.js is in routes folder)
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

