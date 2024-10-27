const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const User = require('../models/user');
const Pet = require('../models/pet');
const mongoose = require('mongoose');
const Reservation = require('../models/reservation');  // Import Reservation model
const AdminPetList = require('../models/adminPetlist');  // Ensure correct path
const moment = require('moment');
const excel = require('exceljs');
const fs = require('fs');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas'); // Import for chart creation




// Admin credentials
const adminEmail = process.env.ADMIN_EMAIL || 'admin@clinic.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

// Set up Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');  // Upload directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));  // Append timestamp to file name
  }
});

const upload = multer({ storage: storage });

// Home route to handle root "/"
router.get('/', (req, res) => {
  res.render('home');  // Render the home.ejs page
});

// Register route
router.get('/register', (req, res) => {
  res.render('register');
});

// Register a new user
router.post('/register', async (req, res) => {
  const { fullName, contactNumber, address, password } = req.body;
  let email = req.body.email;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.render('register', { 
        error: 'Email already exists', 
        email: '', 
        fullName, 
        contactNumber, 
        address 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      fullName,
      email,
      contactNumber,
      address,
      password: hashedPassword
    });

    await newUser.save();
    res.render('register', { success: true });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error saving user to the database');
  }
});

// Login route
router.get('/login', (req, res) => {
  res.render('login');
});

// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (email === adminEmail && password === adminPassword) {
      req.session.user = { email: adminEmail, role: 'admin' };
      return res.redirect('/admin/dashboard');
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).send('User not found');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send('Incorrect password');

    req.session.user = { email: user.email, fullName: user.fullName, role: 'user' };
    res.redirect('/dashboard');
  } catch (err) {
    console.log(err);
    res.status(500).send('Error logging in');
  }
});

// Admin landing page with pagination
router.get('/admin', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  const page = parseInt(req.query.page) || 1; 
  const limit = 5;  
  const skip = (page - 1) * limit;

  try {
    const totalReservations = await Reservation.countDocuments(); 
    const reservations = await Reservation.find()
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalReservations / limit);

    res.render('admin-reservations', {
      reservations,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching reservations');
  }
});

// Admin route for today's schedule with pagination
router.get('/admin/today-schedule', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  const page = parseInt(req.query.page) || 1; // Current page, default to 1
  const limit = 5;  // Limit to 5 reservations per page
  const skip = (page - 1) * limit;  // Calculate how many to skip

  try {
    // Get today's date at 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get tomorrow's date at 00:00:00 to cover full day range
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Count total reservations for today
    const totalReservations = await Reservation.countDocuments({
      date: { $gte: today, $lt: tomorrow }
    });

    // Fetch the reservations for today, with pagination
    const todayReservations = await Reservation.find({
      date: { $gte: today, $lt: tomorrow }
    })
      .sort({ time: 1 })  // Sort by time
      .skip(skip)  // Skip the previous pages' records
      .limit(limit);  // Limit to 5 records per page

    // Calculate total number of pages
    const totalPages = Math.ceil(totalReservations / limit);

    // Render the page with reservations and pagination info
    res.render('admin-reservations', {
      reservations: todayReservations,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching today\'s schedule');
  }
});



// User landing page (Dashboard)
router.get('/dashboard', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'user') {
    return res.redirect('/login');
  }
  res.render('user', { userName: req.session.user.fullName });
});

// Add Pet form
router.get('/add-pet', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'user') {
    return res.redirect('/login');
  }
  
  res.render('user', { userName: req.session.user.fullName });
});

// Add Pet form submission
router.post('/add-pet', upload.single('vetCard'), async (req, res) => {
  const { petName, breed, birthday, ownerName } = req.body;
  const vetCardPath = req.file ? req.file.filename : null;

  try {
    const newPet = new Pet({
      petName,
      breed,
      birthday: birthday ? new Date(birthday) : null, // Handle optional birthday
      ownerName,
      vetCard: vetCardPath,
      isAdminAdded: false  // User-added pets have this set to false
    });

    await newPet.save();
    res.redirect('/your-pets');
  } catch (err) {
    console.log(err);
    res.status(500).send('Error adding pet');
  }
});

router.post('/admin/add-pet', async (req, res) => {
  const { petName, breed, ownerName, birthday } = req.body;

  try {
    const newPet = new AdminPetList({
      petName,
      breed,
      ownerName,
      birthday: birthday ? new Date(birthday) : null
    });

    await newPet.save();
    res.redirect('/admin/petlist?success=1');
  } catch (err) {
    console.error('Error saving pet:', err);  // Log the error to console
    res.status(500).send('Error adding pet');
  }
});

router.get('/admin/petlist', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  const searchQuery = req.query.searchQuery || '';  // Fetch search query if provided
  const page = parseInt(req.query.page) || 1; // Current page, default to 1
  const limit = 5; // Limit to 5 pets per page
  const skip = (page - 1) * limit;

  try {
    const totalPets = await AdminPetList.countDocuments({
      ownerName: { $regex: new RegExp(searchQuery, 'i') }  // Filter by owner name if searching
    });

    const pets = await AdminPetList.find({
      ownerName: { $regex: new RegExp(searchQuery, 'i') }
    }).skip(skip).limit(limit);

    const totalPages = Math.ceil(totalPets / limit);

    res.render('admin-petlist', {
      pets,
      searchQuery,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching pet list');
  }
});


// Reserve pet submission (only one active reservation per pet)
router.post('/reserve-pet/:id', async (req, res) => {
  const { date, time, note } = req.body;
  const petId = req.params.id;

  try {
    // Check if the pet already has a pending reservation
    const existingReservation = await Reservation.findOne({ 
      petId: petId, 
      isDone: false  // isDone should be false for pending consultations
    });

    if (existingReservation) {
      return res.status(400).send('You still have a pending consultation for this pet.');
    }

    // Proceed to create reservation if no pending consultation
    const pet = await Pet.findById(petId);
    if (!pet) {
      return res.status(404).send('Pet not found');
    }

    const reservation = new Reservation({
      petName: pet.petName,
      breed: pet.breed,
      ownerName: pet.ownerName,
      petId: petId,
      date: new Date(date),
      time,
      note,
      vetCard: pet.vetCard,
      isDone: false  // This marks the reservation as pending (not completed)
    });

    await reservation.save();
    res.redirect('/your-pets');
  } catch (err) {
    console.log(err);
    res.status(500).send('Error making reservation');
  }
});



// List user's pets with pagination and pending consultation info
router.get('/your-pets', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'user') {
    return res.redirect('/login');
  }

  const page = parseInt(req.query.page) || 1; // Current page, default is 1
  const limit = 5; // Limit to 5 pets per page
  const skip = (page - 1) * limit; // Skip the previous pages

  try {
    const totalPets = await Pet.countDocuments({ ownerName: req.session.user.fullName }); // Total pets
    const pets = await Pet.find({ ownerName: req.session.user.fullName })
      .skip(skip)
      .limit(limit);

    // Check for pending consultations for each pet
    const petsWithPendingConsultations = await Promise.all(
      pets.map(async pet => {
        const hasPendingConsultation = await Reservation.findOne({ 
          petId: pet._id, 
          isDone: false 
        });
        return { ...pet._doc, hasPendingConsultation: !!hasPendingConsultation }; // Add pending status to pet object
      })
    );

    const totalPages = Math.ceil(totalPets / limit); // Total number of pages

    res.render('your-pets', { 
      pets: petsWithPendingConsultations, 
      userName: req.session.user.fullName,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching pets');
  }
});


// Fetch user reservations with pagination
router.get('/reservations', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'user') {
    return res.redirect('/login');
  }

  const page = parseInt(req.query.page) || 1; // Current page, default is 1
  const limit = 5; // Limit to 5 reservations per page
  const skip = (page - 1) * limit; // Calculate how many documents to skip

  try {
    const totalReservations = await Reservation.countDocuments({ ownerName: req.session.user.fullName });
    const reservations = await Reservation.find({ ownerName: req.session.user.fullName })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalReservations / limit);

    // Pass currentPage, totalPages, and reservations to the view
    res.render('user-reservations', {
      reservations,
      userName: req.session.user.fullName,
      currentPage: page,   // This is where currentPage is defined
      totalPages
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching reservations');
  }
});

// Cancel a reservation
router.get('/cancel-reservation/:id', async (req, res) => {
  try {
    await Reservation.findByIdAndDelete(req.params.id);
    res.redirect('/reservations');
  } catch (err) {
    console.log(err);
    res.status(500).send('Error cancelling reservation');
  }
});

// Admin Reservation List route (all reservations)
router.get('/admin/reservations', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Set time to UTC midnight

    // Find reservations that are not done and the date is today or in the future
    const totalReservations = await Reservation.countDocuments({
      date: { $gte: today },  // Only reservations today or later
      isDone: false  // Exclude already marked done
    });

    const reservations = await Reservation.find({
      date: { $gte: today },  // Only reservations today or later
      isDone: false  // Exclude already marked done
    })
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalReservations / limit);

    res.render('admin-reservations', {
      reservations,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching reservations');
  }
});



// Route to mark reservation as done
router.post('/admin/mark-done/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  try {
    await Reservation.findByIdAndUpdate(req.params.id, { isDone: true });
    res.redirect('/admin/reservations');
  } catch (err) {
    console.log(err);
    res.status(500).send('Error marking reservation as done');
  }
});

// Route for displaying all done reservations (History)
router.get('/admin/history', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  try {
    const totalReservations = await Reservation.countDocuments({ isDone: true });
    const historyReservations = await Reservation.find({ isDone: true })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalReservations / limit);

    // Add the `isPetAdded` field to check if each reservation's pet is already in the pet list
    const updatedReservations = await Promise.all(historyReservations.map(async (reservation) => {
      // Find exact match for petName only, ignore ownerName
      const petExists = await Pet.findOne({
        petName: reservation.petName,  // Check only for petName match
      });

      return {
        ...reservation._doc,
        isPetAdded: !!petExists  // Add isPetAdded field based on the pet's existence
      };
    }));

    res.render('admin-history', {
      reservations: updatedReservations,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching reservation history');
  }
});

// Route to filter reservations by today in history
router.get('/admin/history/today', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  const page = parseInt(req.query.page) || 1; // Current page, default to 1
  const limit = 5;  // Limit to 5 reservations per page
  const skip = (page - 1) * limit;  // Calculate how many reservations to skip for pagination

  try {
    // Get today's date at 00:00:00 and tomorrow at 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Count today's reservations that are marked as done (history)
    const totalReservations = await Reservation.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      isDone: true  // Only get completed reservations
    });

    // Fetch today's reservations with pagination
    const todayReservations = await Reservation.find({
      date: { $gte: today, $lt: tomorrow },
      isDone: true
    })
      .sort({ time: 1 })  // Sort by time
      .skip(skip)  // Skip previous pages
      .limit(limit);  // Limit results to 5 per page

    // Calculate total pages for pagination
    const totalPages = Math.ceil(totalReservations / limit);

    // Render the reservations and pagination
    res.render('admin-history', {
      reservations: todayReservations,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching today\'s reservations');
  }
});

// Route to delete a reservation from history
router.post('/admin/delete-reservation/:id', async (req, res) => {
  try {
    await Reservation.findByIdAndDelete(req.params.id);
    res.redirect('/admin/history');  // Redirect back to the history page
  } catch (err) {
    console.log(err);
    res.status(500).send('Error deleting reservation');
  }
});

// Route to display Pet List
router.get('/admin/petlist', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  const searchQuery = req.query.searchQuery || ''; // Fetch search query if provided

  try {
    const pets = await Pet.find({ 
      isAdminAdded: true,
      ownerName: { $regex: new RegExp(searchQuery, 'i') }  // Filter by owner name
    });
    res.render('admin-petlist', { pets, searchQuery });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching pet list');
  }
});

// Route to delete a pet
router.post('/admin/delete-pet/:id', async (req, res) => {
  const petId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(petId)) {
    console.error('Invalid Pet ID format:', petId);
    return res.status(400).send('Invalid Pet ID format');
  }

  try {
    const deletedPet = await AdminPetList.findByIdAndDelete(petId);  // Use AdminPetList here

    if (!deletedPet) {
      console.error('Pet not found for deletion');
      return res.status(404).send('Pet not found');
    }

    console.log('Pet deleted successfully:', petId);
    res.redirect('/admin/petlist');
  } catch (err) {
    console.error('Error deleting pet:', err);
    res.status(500).send('Error deleting pet');
  }
});
// Route to edit a pet's details
router.post('/admin/edit-pet', upload.single('vetCard'), async (req, res) => {
  const { petId, ownerName, birthday } = req.body;
  const vetCardPath = req.file ? req.file.filename : null;  // Check if a vet card is uploaded

  try {
    const updateData = {
      ownerName,
      birthday: birthday ? new Date(birthday) : null,  // Update birthday if provided
    };

    // If a new vet card is uploaded, include it in the update
    if (vetCardPath) {
      updateData.vetCard = vetCardPath;
    }

    // Update the pet in MongoDB
    await AdminPetList.findByIdAndUpdate(petId, updateData);

    // After saving, redirect back to the pet list
    res.redirect('/admin/petlist');
  } catch (err) {
    console.error('Error updating pet:', err);
    res.status(500).send('Error editing pet');
  }
});


// Route to view pet history (For now, assuming it's simple reservation history)
router.get('/admin/pet-history/:id', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    const reservations = await Reservation.find({ petName: pet.petName });
    res.render('admin-pet-history', { pet, reservations });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching pet history');
  }
});
// Edit a pet's owner name
router.post('/edit-pet/:id', async (req, res) => {
  const { ownerName } = req.body; // Ensure you're receiving the ownerName from the form
  try {
    await Pet.findByIdAndUpdate(req.params.id, { ownerName }); // Update only ownerName
    res.redirect('/your-pets'); // Redirect after updating, no JSON response needed
  } catch (err) {
    console.log(err);
    res.status(500).send('Error updating pet');
  }
});

// Delete a pet
router.post('/delete-pet/:id', async (req, res) => {
  try {
    await Pet.findByIdAndDelete(req.params.id);
    res.redirect('/your-pets'); // Redirect after deletion
  } catch (err) {
    console.log(err);
    res.status(500).send('Error deleting pet');
  }
});
// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      return res.redirect('/dashboard'); // Redirect to dashboard if there's an error
    }
    res.redirect('/'); // Redirect to home.ejs (the root route) after logout
  });
});
// Route to check availability for a specific date
router.get('/check-availability', async (req, res) => {
  const { date } = req.query;

  try {
    const reservations = await Reservation.aggregate([
      { $match: { date: new Date(date) } },
      { $group: { _id: "$time", count: { $sum: 1 } } },
      { $match: { count: { $gte: 5 } } } // Find time slots with 5 or more reservations
    ]);

    const fullSlots = reservations.map(r => r._id); // Extract the time slots that are full
    res.json(fullSlots); // Return the full time slots as an array
  } catch (err) {
    console.log(err);
    res.status(500).send('Error checking availability');
  }
});

router.post('/admin/add-history/:id', async (req, res) => {
  const petId = req.params.id;
  const { date, note } = req.body;

  console.log('Incoming Request - Pet ID:', petId);
  console.log('Incoming Request - Body:', req.body);  // Log the body to see if it's parsed

  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(petId)) {
      console.log('Invalid Pet ID:', petId);
      return res.status(400).json({ success: false, message: 'Invalid Pet ID' });
    }

    // Validate date
    const validDate = new Date(date);
    if (isNaN(validDate.getTime())) {
      console.log('Invalid Date:', date);
      return res.status(400).json({ success: false, message: 'Invalid Date' });
    }

    // Add history entry to pet
    const updatedPet = await AdminPetList.findByIdAndUpdate(
      petId,
      { $push: { history: { date: validDate, note } } },
      { new: true }
    );

    if (!updatedPet) {
      console.log('Pet not found with ID:', petId);
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error adding history:', err);
    res.status(500).json({ success: false, message: 'Error adding history' });
  }
});
router.put('/admin/update-history/:id', async (req, res) => {
  const { id } = req.params;  // Get the history entry ID from the URL
  const { date, note } = req.body;  // Get the updated data from the request body

  try {
    const validDate = new Date(date);
    if (isNaN(validDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid Date' });
    }

    const updatedPet = await AdminPetList.findOneAndUpdate(
      { 'history._id': id }, // Find the specific history entry by ID
      {
        $set: {
          'history.$.date': validDate,
          'history.$.note': note,
        }
      },
      { new: true }
    );

    if (!updatedPet) {
      return res.status(404).json({ success: false, message: 'History entry not found' });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error updating history:', err);
    res.status(500).json({ success: false, message: 'Error updating history' });
  }
});
router.delete('/admin/delete-history/:id', async (req, res) => {
  const { id } = req.params;  // Get the history entry ID from the URL

  try {
    const updatedPet = await AdminPetList.findOneAndUpdate(
      { 'history._id': id },  // Find the pet that contains the history entry
      {
        $pull: { history: { _id: id } }  // Remove the specific history entry by ID
      },
      { new: true }
    );

    if (!updatedPet) {
      return res.status(404).json({ success: false, message: 'History entry not found' });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting history:', err);
    res.status(500).json({ success: false, message: 'Error deleting history' });
  }
});
// Add the route for Pet History
router.get('/pethistory', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'user') {
    return res.redirect('/login');
  }

  const page = parseInt(req.query.page) || 1;  // Default to page 1 if no query param
  const limit = 5;  // Maximum number of entries per page
  const skip = (page - 1) * limit;  // Calculate how many records to skip

  try {
    // Fetch total pet entries that belong to the logged-in user
    const totalPets = await AdminPetList.countDocuments({
      ownerName: req.session.user.fullName
    });

    // Fetch the pet history entries for the logged-in user with pagination
    const pets = await AdminPetList.find({
      ownerName: req.session.user.fullName
    }).skip(skip).limit(limit);

    const totalPages = Math.ceil(totalPets / limit);  // Calculate total pages

    // Render the view and pass the necessary variables
    res.render('pethistory', {
      pets,
      userName: req.session.user.fullName,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching pet history');
  }
});
// Function to clear reservations that are not marked as done by 12:00 AM the next day
const clearPastReservations = async () => {
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);  // Set time to midnight of the current day

  try {
    // Find and delete reservations where the date is less than today (i.e., reservations from the previous day)
    // and are not marked as done
    const result = await Reservation.deleteMany({
      date: { $lt: currentDate },  // Reservations before today
      isDone: false  // Only delete reservations that are not marked as done
    });

    console.log(`Cleared ${result.deletedCount} outdated reservations.`);
  } catch (err) {
    console.log('Error while clearing reservations:', err);
  }
};

// Schedule the function to run daily at 12:00 AM
const scheduleDailyClear = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);  // Set time to next 12:00 AM

  const timeUntilMidnight = midnight.getTime() - now.getTime();  // Calculate the time remaining until midnight

  setTimeout(() => {
    clearPastReservations();  // Run the function at midnight
    setInterval(clearPastReservations, 24 * 60 * 60 * 1000);  // Schedule it to run every 24 hours after that
  }, timeUntilMidnight);
};

// Start the daily clearing process
scheduleDailyClear();
router.get('/admin/dashboard', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  try {
    const totalUsers = await User.countDocuments();
    const userPets = await Pet.countDocuments({ isAdminAdded: false });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayReservations = await Reservation.countDocuments({
      date: { $gte: today, $lt: tomorrow }
    });

    // Monthly reservation data for line chart
    const reservationsByMonth = await Reservation.aggregate([
      { $match: { isDone: true } },
      {
        $group: {
          _id: { $month: "$date" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Extract data for frontend chart
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const reservationCounts = months.map(month => {
      const monthData = reservationsByMonth.find(data => data._id === month);
      return monthData ? monthData.count : 0;
    });

    res.render('admin-dashboard', {
      totalUsers,
      userPets,
      todayReservations,
      months,
      reservationCounts
    });
  } catch (err) {
    console.log('Error loading dashboard:', err);
    res.status(500).send('Error loading dashboard');
  }
});

router.get('/admin/generate-report', async (req, res) => {
  const { reportType, startDate, endDate } = req.query;

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Set to end of the day

    // Fetch reservations marked as done within the specified date range
    const reservations = await Reservation.find({
      isDone: true,
      date: { $gte: start, $lte: end }
    });

    // Set up workbook and worksheet
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet(`${reportType} Report`);

    // Define columns
    worksheet.columns = [
      { header: 'Pet Name', key: 'petName', width: 15 },
      { header: 'Breed', key: 'breed', width: 15 },
      { header: 'Owner Name', key: 'ownerName', width: 15 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Time', key: 'time', width: 10 },
      { header: 'Notes', key: 'note', width: 30 },
      { header: 'Vet Card', key: 'vetCard', width: 15 }
    ];

    // Add rows to worksheet
    reservations.forEach(reservation => {
      worksheet.addRow({
        petName: reservation.petName,
        breed: reservation.breed,
        ownerName: reservation.ownerName,
        date: reservation.date.toDateString(),
        time: reservation.time,
        note: reservation.note,
        vetCard: reservation.vetCard ? 'Available' : 'Not Available'
      });
    });

    // Set response headers for file download
    const fileName = `${reportType}_Report_${startDate}_to_${endDate}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${fileName}`
    );

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).send('Error generating report');
  }
});

module.exports = router;
