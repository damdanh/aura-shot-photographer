require('dotenv').config();
const mongoose = require('mongoose');
const PhotographerProfile = require('../models/PhotographerProfile');
const User = require('../models/User');

const convertToSlug = (text) => {
  if (!text) return "";
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/([^0-9a-z-\s])/g, '')
    .replace(/(\s+)/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

async function runBackfill() {
  console.log("Connecting to database...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  console.log("Finding profiles without a valid slug...");
  const profiles = await PhotographerProfile.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }] }).populate('user_id');
  
  console.log(`Found ${profiles.length} profiles to update.`);

  let updatedCount = 0;
  for (const profile of profiles) {
    const nameToSlugify = profile.storeName || (profile.user_id && profile.user_id.full_name) || "Store";
    const newSlug = convertToSlug(nameToSlugify);
    
    if (newSlug) {
      // Append some random string if slug already exists to prevent unique constraint violation?
      // Since it's a datn project, let's just attempt to save. If it fails due to unique constraint, we can catch it.
      let finalSlug = newSlug;
      let isUnique = false;
      let counter = 0;
      
      while (!isUnique) {
        try {
          const existing = await PhotographerProfile.findOne({ slug: finalSlug });
          if (!existing || existing._id.equals(profile._id)) {
            isUnique = true;
          } else {
            counter++;
            finalSlug = `${newSlug}-${counter}`;
          }
        } catch(e) {
          console.error("Error checking slug uniqueness:", e);
          break;
        }
      }

      profile.slug = finalSlug;
      await profile.save();
      console.log(`Updated profile ${profile._id} with slug: ${finalSlug}`);
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} profiles.`);
  await mongoose.disconnect();
}

runBackfill().catch(async (error) => {
  console.error("Backfill failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
