import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.model.js';

dotenv.config();

const clearRefreshTokens = async () => {
  try {
    // Connect to database
    await mongoose.connect(`${process.env.MONGODB_URI}/EventFlex`);
    console.log('Connected to database');

    // Clear all refresh tokens
    const result = await User.updateMany(
      {},
      { $unset: { refreshToken: 1 } }
    );

    console.log(`✅ Cleared refresh tokens from ${result.modifiedCount} users`);
    console.log('Users need to re-login with their credentials');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing tokens:', error);
    process.exit(1);
  }
};

clearRefreshTokens();
