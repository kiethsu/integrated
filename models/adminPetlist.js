const mongoose = require('mongoose');

const AdminPetListSchema = new mongoose.Schema({
  petName: { type: String, required: true },
  breed: { type: String, required: true },
  birthday: { type: Date, required: false },
  ownerName: { type: String, required: true },
  vetCard: { type: String }, // Optional field for vet card
  history: [
    {
      date: { type: Date, required: true },
      note: { type: String, required: true }
    }
  ] // Array of history records
});

module.exports = mongoose.model('AdminPetList', AdminPetListSchema);
