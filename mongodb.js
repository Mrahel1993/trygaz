const mongoose = require('mongoose');

const mongoURI = 'your-mongodb-uri';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB connection lost. Reconnecting...');
    mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => console.log('Reconnected to MongoDB Atlas'))
        .catch(err => console.error('Failed to reconnect:', err));
});

module.exports = mongoose;
