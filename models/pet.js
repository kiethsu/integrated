const mongoose = require('mongoose');

const PetSchema = new mongoose.Schema({
  petName: { type: String, required: true },
  breed: { type: String, required: true },
  birthday: { type: Date, required: false },
  ownerName: { type: String, required: true },
  vetCard: { type: String },  // Optional field to store the path to the vet card image
  isAdminAdded: { type: Boolean, default: false }  // Track if pet was added by admin
});

module.exports = mongoose.model('Pet', PetSchema);
