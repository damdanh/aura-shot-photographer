
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Cart = require('../models/Cart');

const customers = [
  {
    full_name: 'Nguyễn Minh Anh',
    email: 'minhanh@aurashot.vn'
  },
  {
    full_name: 'Trần Hoàng Nam',
    email: 'hoangnam@aurashot.vn'
  }
];

async function seed() {
  try {
    const {
      MONGO_URI,
      MONGO_DB_NAME,
      DEMO_CUSTOMER_PASSWORD
    } = process.env;

    if (!MONGO_URI) {
      throw new Error('Thiếu MONGO_URI trong backend/.env');
    }

    if (!MONGO_DB_NAME) {
      throw new Error('Thiếu MONGO_DB_NAME trong backend/.env');
    }

    if (!DEMO_CUSTOMER_PASSWORD || DEMO_CUSTOMER_PASSWORD.length < 16) {
      throw new Error(
        'DEMO_CUSTOMER_PASSWORD phải có ít nhất 16 ký tự'
      );
    }

    await mongoose.connect(MONGO_URI, {
      dbName: MONGO_DB_NAME
    });

    for (const customer of customers) {
      const hashedPassword = await bcrypt.hash(
        DEMO_CUSTOMER_PASSWORD,
        10
      );

      const user = await User.findOneAndUpdate(
        { email: customer.email },
        {
          $set: {
            full_name: customer.full_name,
            email: customer.email,
            password: hashedPassword,
            role: 'customer',
            is_active: true,
            is_banned: false,
            isDeleted: false
          }
        },
        {
          upsert: true,
          returnDocument: 'after',
          runValidators: true
        }
      );

      await Cart.findOneAndUpdate(
        { user_id: user._id },
        {
          $setOnInsert: {
            user_id: user._id,
            items: []
          }
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );

      console.log(`Đã tạo/cập nhật tài khoản: ${customer.email}`);
    }

    console.log(
      `Đã hoàn tất ${customers.length} tài khoản Demo.`
    );

  } catch (error) {
    console.error(
      'Tạo tài khoản khách hàng thất bại:',
      error.message
    );

    process.exitCode = 1;

  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

seed();
