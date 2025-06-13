const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;

// ====== Middlewares ======
app.use(cors());
app.use(express.json());

// ====== MongoDB connection ======
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/voting-app')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ====== Models ======
const Player = require('./models/Player');
const Vote = require('./models/Vote');
const User = require('./models/User');

// ====== Auth Middleware ======
function auth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(403).json({ message: 'Forbidden' });
    req.user = user;
    next();
  });
}

// ====== Routes ======

// [GET] All players
app.get('/api/players', async (req, res) => {
  try {
    const players = await Player.find();
    res.json(players);
  } catch (err) {
    console.error('Error fetching players:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// [POST] Add view
app.post('/api/players/:id/view', async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: 'Player not found' });
    player.views += 1;
    await player.save();
    res.json({ message: 'View added' });
  } catch (err) {
    console.error('Error in view:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// [POST] Admin view
app.post('/api/players/:id/admin-view', auth, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: 'Player not found' });
    player.views += 5;
    await player.save();
    res.json({ message: 'Admin view added' });
  } catch (err) {
    console.error('Error in admin-view:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// [DELETE] Delete player
app.delete('/api/players/:id', auth, async (req, res) => {
  try {
    await Player.findByIdAndDelete(req.params.id);
    res.json({ message: 'Player deleted' });
  } catch (err) {
    console.error('Error deleting player:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// [GET] Vote data
app.get('/api/vote', async (req, res) => {
  try {
    const votePlayers = await Vote.find().populate('playerId');
    const formatted = votePlayers.map(v => ({
      _id: v.playerId._id,
      name: v.playerId.name,
      image: v.playerId.image,
      voteCount: v.voteCount || 0
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching vote data:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// [POST] Add player to vote
app.post('/api/vote/add/:id', auth, async (req, res) => {
  try {
    const playerId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ message: 'Invalid player ID' });
    }

    const player = await Player.findById(playerId);
    if (!player) return res.status(404).json({ message: 'Player not found' });

    const exists = await Vote.findOne({ playerId });
    if (exists) return res.status(409).json({ message: 'Player already in vote list' });

    await Vote.create({ playerId, voteCount: 0 });
    res.json({ message: 'Player added to vote list' });
  } catch (err) {
    console.error('Error adding player to vote:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// [POST] Cast a vote
app.post('/api/vote/:id', async (req, res) => {
  try {
    const voteEntry = await Vote.findOne({ playerId: req.params.id });
    if (!voteEntry) return res.status(404).json({ message: 'Player not in vote list' });

    voteEntry.voteCount += 1;
    await voteEntry.save();
    res.json({ message: 'Vote counted' });
  } catch (err) {
    console.error('Error casting vote:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// [POST] Admin manual vote
app.post('/api/vote/admin/:id', auth, async (req, res) => {
  try {
    const voteEntry = await Vote.findOne({ playerId: req.params.id });
    if (!voteEntry) return res.status(404).json({ message: 'Player not in vote list' });

    voteEntry.voteCount += 1;
    await voteEntry.save();
    res.json({ message: 'Manual vote added' });
  } catch (err) {
    console.error('Error adding manual vote:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// [POST] Start voting
let voteEndTime = null;
app.post('/api/vote/start', auth, async (req, res) => {
  try {
    voteEndTime = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes
    console.log('✅ Voting started until:', voteEndTime);
    res.json({ message: 'Voting started', endTime: voteEndTime });
  } catch (err) {
    console.error('Error starting vote:', err);
    res.status(500).json({ message: 'Failed to start voting' });
  }
});

// [GET] Get vote end time
app.get('/api/vote/endtime', (req, res) => {
  try {
    if (!voteEndTime) return res.status(404).json({ message: 'Voting not started' });
    res.json({ endTime: voteEndTime });
  } catch (err) {
    console.error('Error getting vote end time:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ====== Start server ======
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
