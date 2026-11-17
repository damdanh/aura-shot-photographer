const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Product = require('../models/Product');
const Service = require('../models/Service');
const User = require('../models/User');
const UserPackage = require('../models/UserPackage');
const PhotographerProfile = require('../models/PhotographerProfile');
const Album = require('../models/Album');
const Photo = require('../models/Photo');
// 1. GET /api/store/customers -> Thợ ảnh lấy danh sách khách hàng đã mua của mình
exports.getStoreCustomers = async (req, res) => {
  try {
    const photographerId = req.user.id;

    // Lấy danh sách sản phẩm thuộc sở hữu của thợ ảnh này
    const photographerProducts = await Product.find({ user_id: photographerId }).select('_id');
    const productIds = photographerProducts.map(p => p._id);

    // Lấy danh sách dịch vụ thuộc sở hữu của thợ ảnh này
    const photographerServices = await Service.find({ user_id: photographerId }).select('_id');
    const serviceIds = photographerServices.map(s => s._id);

    // Tìm tất cả các chi tiết đơn hàng (OrderItem) chứa sản phẩm hoặc dịch vụ của thợ ảnh
    const items = await OrderItem.find({
      $or: [
        { product_id: { $in: productIds } },
        { service_id: { $in: serviceIds } }
      ]
    })
      .populate({
        path: 'order_id',
        populate: { path: 'user_id', select: 'email' }
      });

    const customersMap = {};

    items.forEach(item => {
      // Thống kê những đơn hàng đã thanh toán thành công (Paid, Processing, Delivered, Completed)
      if (!item.order_id || !['Paid', 'Processing', 'Delivered', 'Completed'].includes(item.order_id.status)) return;

      const customerKey = item.order_id.phone || item.order_id.customer_name;
      if (!customersMap[customerKey]) {
        customersMap[customerKey] = {
          customer_name: item.order_id.customer_name,
          phone: item.order_id.phone,
          email: item.order_id.user_id ? item.order_id.user_id.email : 'Khách vãng lai',
          order_count: 0,
          total_spent: 0,
          order_ids: new Set()
        };
      }

      const customer = customersMap[customerKey];
      customer.total_spent += item.unit_price * item.quantity;
      customer.order_ids.add(item.order_id._id.toString());
    });

    // Định dạng lại kết quả trả về
    const customersList = Object.values(customersMap).map(c => {
      c.order_count = c.order_ids.size;
      delete c.order_ids; // Ẩn trường Set nội bộ
      return c;
    });

    return res.status(200).json({
      success: true,
      count: customersList.length,
      data: customersList
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách khách hàng: " + error.message
    });
  }
};
// 2. GET /api/store/stats -> Xem biểu đồ doanh thu, số đơn và số sao nâng cao của riêng thợ chụp
exports.getStoreStats = async (req, res) => {
  try {
    const photographerId = req.user.id;

    // 1. Lấy thông tin số sao đánh giá từ profile thợ ảnh
    const profile = await PhotographerProfile.findOne({ user_id: photographerId });
    const ratingAverage = profile ? profile.rating_average : 0;
    const ratingCount = profile ? profile.rating_count : 0;

    // 2. Thay vì dùng ví nội bộ (do chuyển sang P2P), tính doanh thu và công nợ trực tiếp từ các đơn hàng.
    const completedOrPaidOrders = await Order.find({
      photographer_id: photographerId,
      status: { $in: ['Paid', 'Processing', 'Delivered', 'Completed'] }
    });

    // Doanh thu tạm tính (chưa trừ công nợ)
    const balance = completedOrPaidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const lockedBalance = 0; // Bỏ khóa ví
    const totalWithdrawn = 0; // Bỏ rút tiền
    const totalRevenue = completedOrPaidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalTransactions = completedOrPaidOrders.length;

    // 5. Thống kê tỷ lệ trạng thái đơn hàng (để vẽ biểu đồ tròn)
    const allOrders = await Order.find({ photographer_id: photographerId });
    const statusDistribution = {
      Pending: 0,
      Paid: 0,
      Processing: 0,
      Delivered: 0,
      Completed: 0,
      cancelled: 0
    };
    allOrders.forEach(o => {
      const status = o.status;
      if (statusDistribution[status] !== undefined) {
        statusDistribution[status]++;
      } else if (status.toLowerCase() === 'cancelled') {
        statusDistribution['cancelled']++;
      }
    });

    // 6. Thống kê top 5 dịch vụ/sản phẩm bán chạy nhất
    const photographerProducts = await Product.find({ user_id: photographerId }).select('_id name');
    const photographerServices = await Service.find({ user_id: photographerId }).select('_id name');
    const productMap = {};
    photographerProducts.forEach(p => { productMap[p._id.toString()] = p.name; });
    const serviceMap = {};
    photographerServices.forEach(s => { serviceMap[s._id.toString()] = s.name; });

    const items = await OrderItem.find({
      $or: [
        { product_id: { $in: Object.keys(productMap) } },
        { service_id: { $in: Object.keys(serviceMap) } }
      ]
    }).populate('order_id');

    const salesMap = {};
    items.forEach(item => {
      if (!item.order_id || !['Paid', 'Processing', 'Delivered', 'Completed'].includes(item.order_id.status)) return;
      
      const itemId = item.product_id ? item.product_id.toString() : item.service_id.toString();
      const itemName = item.product_id ? productMap[itemId] : serviceMap[itemId];
      const itemType = item.product_id ? 'product' : 'service';
      
      if (!salesMap[itemId]) {
        salesMap[itemId] = {
          name: itemName || "Sản phẩm/Dịch vụ không tên",
          type: itemType,
          sales_count: 0,
          revenue: 0
        };
      }
      salesMap[itemId].sales_count += item.quantity;
      salesMap[itemId].revenue += item.unit_price * item.quantity;
    });

    const topSellingItems = Object.values(salesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // 7. Thống kê doanh thu theo tháng & ngày của thợ chụp
    const monthlyMap = {};
    const dailyMap = {};

    completedOrPaidOrders.forEach(t => {
      const date = new Date(t.createdAt);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const dayStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      if (!monthlyMap[monthStr]) {
        monthlyMap[monthStr] = { month: monthStr, revenue: 0, order_count: 0, orders: new Set() };
      }
      monthlyMap[monthStr].revenue += (t.total_amount || 0);

      if (!dailyMap[dayStr]) {
        dailyMap[dayStr] = { date: dayStr, revenue: 0, order_count: 0, orders: new Set() };
      }
      dailyMap[dayStr].revenue += (t.total_amount || 0);

      monthlyMap[monthStr].orders.add(t._id.toString());
      dailyMap[dayStr].orders.add(t._id.toString());
    });

    const monthlyStats = Object.values(monthlyMap).map(m => {
      m.order_count = m.orders.size;
      delete m.orders;
      return m;
    });

    const dailyStats = Object.values(dailyMap).map(d => {
      d.order_count = d.orders.size;
      delete d.orders;
      return d;
    });

    const userAlbums = await Album.find({ user_id: photographerId }).select('_id');
    const userAlbumIds = userAlbums.map(a => a._id);
    const photosCount = userAlbumIds.length > 0 ? await Photo.countDocuments({ album_id: { $in: userAlbumIds } }) : 0;

    return res.status(200).json({
      success: true,
      data: {
        balance, // Số dư khả dụng
        locked_balance: lockedBalance, // Số dư tạm khóa
        total_revenue: totalRevenue, // Tổng tiền đã vào túi (hoặc ví)
        total_withdrawn: totalWithdrawn, // Tổng tiền đã rút thành công
        total_transactions: totalTransactions, // Tổng số đơn hàng có tiền
        total_orders: allOrders.length, // Trả về tổng tất cả đơn hàng để khớp với OrdersPage
        rating_average: ratingAverage,
        rating_count: ratingCount,
        order_status_distribution: statusDistribution,
        top_selling_items: topSellingItems,
        monthly_stats: monthlyStats,
        daily_stats: dailyStats,
        products_count: await Product.countDocuments({ user_id: photographerId, status: { $ne: 'deleted' } }),
        services_count: await Service.countDocuments({ user_id: photographerId, status: { $ne: 'deleted' } }),
        albums_count: userAlbums.length,
        photos_count: photosCount
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy thống kê gian hàng: " + error.message
    });
  }
};


// 3. GET /api/admin/stats -> Admin xem báo cáo tổng thể (Doanh thu sàn từ SaaS, tổng giao dịch)
exports.getAdminStats = async (req, res) => {
  try {
    // 1. Thống kê từ đơn hàng thành công (Mô hình SaaS hoa hồng bằng 0)
    const completedOrders = await Order.find({ status: 'Completed' });
    let totalRevenue = 0; // Tổng dòng tiền giao dịch của các đơn hàng
    //tính tổng doanh thu từ phí hoa hồng của thợ ảnh đã trừ
    completedOrders.forEach(order => {
      totalRevenue += (order.deposit_amount || 0);
    });
    // 2. Thống kê số lượng người dùng
    const totalPhotographers = await User.countDocuments({ role: 'photographer' });
    const totalCustomers = await User.countDocuments({ role: 'customer' });

    // 3. Thống kê doanh thu từ gói dịch vụ SaaS (Tính tổng lịch sử bán gói)
    const allSubscriptions = await UserPackage.find({}).populate('package_id');
    let totalSaaSRevenue = 0;

    allSubscriptions.forEach(sub => {
      if (sub.price_paid !== undefined && sub.price_paid !== null) {
        totalSaaSRevenue += sub.price_paid;
      } else if (sub.package_id) {
        totalSaaSRevenue += sub.package_id.price;
      }
    });
    return res.status(200).json({
      success: true,
      data: {
        total_transaction_value: totalRevenue,
        total_saas_revenue: totalSaaSRevenue,
        total_photographers: totalPhotographers,
        total_customers: totalCustomers,
        total_completed_orders: completedOrders.length
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống thống kê admin: " + error.message
    });
  }
};
