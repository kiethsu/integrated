const mongoose = require('mongoose');

// Define the schema for the Reservation
const reservationSchema = new mongoose.Schema({
  petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true }, // Reference to the Pet model
  petName: { type: String, required: true },
  breed: { type: String, required: true },
  ownerName: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  note: { type: String, required: true },
  vetCard: { type: String },  // Optional vet card
  isDone: { type: Boolean, default: false },  // Field for marking as done
  createdAt: { type: Date, default: Date.now }  // Add createdAt field to track when reservation was made
});

// Create the Reservation model
const Reservation = mongoose.model('Reservation', reservationSchema);

module.exports = Reservation;
