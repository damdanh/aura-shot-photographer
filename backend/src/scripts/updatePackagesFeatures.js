const mongoose = require('mongoose');
const Package = require('../models/Package');
require('dotenv').config({ path: __dirname + '/../../.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const packages = await Package.find({});
  
  for (const pkg of packages) {
     if (pkg.features) {
       pkg.features = pkg.features.map(f => {
         if (f.includes('Google Drive')) return null; 
         return f;
       }).filter(Boolean);
       await pkg.save();
     }
  }
  
  console.log("Updated packages successfully");
  mongoose.disconnect();
}
run();
