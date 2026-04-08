import mongoose from "mongoose";
import {DB_Name} from "../constants.js"
const connectedDB = async () => {

  try {
    const connectionDB = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_Name}`, {
      writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 10000
      }
    });
    console.log(` ✅ MongoDB Connected at host: ${connectionDB.connection.host} in DB: ${DB_Name}`);
  } catch (err) {
    console.log(" ❌ MongoDB Connection failed !!", err);
    process.exit(1);
  }

};
export default connectedDB;