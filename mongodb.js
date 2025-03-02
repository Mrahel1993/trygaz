const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://mrahel1993:7Am7dkIitbpVN9Oq@cluster0.rjekk.mongodb.net/userDBtrygaz?retryWrites=true&w=majority';
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
