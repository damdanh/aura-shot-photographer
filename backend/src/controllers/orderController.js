    const Cart = require('../models/Cart');
    const Order = require('../models/Order');
    const OrderItem = require('../models/OrderItem');
    const Product = require('../models/Product');
    const Service = require('../models/Service');
    const Frame = require('../models/Frame');
    const PhotographerProfile = require('../models/PhotographerProfile');
    const Notification = require('../models/Notification');
    const sendEmail = require('../utils/sendEmail');
    // Luồng thanh toán giỏ hàng & tạo đơn hàng chuẩn TMĐT qua cổng PayOS làm mặc định
    exports.checkout = async (req, res) => {
      try {
        const userId = req.user ? req.user.id : null;
        const { customer_name, phone, shipping_address, note, items, payment_method, shipping_fee } = req.body;

        if (!customer_name || !phone) {
          return res.status(400).json({ success: false, message: "Vui lòng nhập tên và số điện thoại liên hệ!" });
        }
        if (!/^0(?:3|5|7|8|9)\d{8}$/.test(String(phone))) {
          return res.status(400).json({ success: false, message: "Số điện thoại không hợp lệ. Vui lòng nhập đúng 10 chữ số Việt Nam!" });
        }

        // 1. Phân giải danh sách sản phẩm/dịch vụ cần thanh toán và xác thực giá
        let cartItems = [];
        let isFromDatabaseCart = false;
        let dbCart = null;

        if (items && Array.isArray(items) && items.length > 0) {
          cartItems = items;
        } else if (userId) {
          dbCart = await Cart.findOne({ user_id: userId })
            .populate('items.product_id')
            .populate('items.service_id');
          if (dbCart && dbCart.items.length > 0) {
            cartItems = dbCart.items;
            isFromDatabaseCart = true;
          }
        }

        if (cartItems.length === 0) {
          return res.status(400).json({ success: false, message: "Giỏ hàng trống! Không thể tiến hành thanh toán." });
        }

        let resolvedItems = [];
        let photographerId = null;
        let hasPhysicalItem = false;

        for (const item of cartItems) {
          let itemUnitPrice = 0;
          let itemPhotographerId = null;
          let productObj = null;
          let serviceObj = null;
          let frameObj = null;
          let framePrice = 0;
          let itemName = "";
          
          const type = item.item_type || 'product';

          if (type === 'product' || item.product_id) {
            productObj = isFromDatabaseCart && item.product_id ? item.product_id : await Product.findById(item.product_id);
            if (!productObj) {
              return res.status(404).json({ success: false, message: `Không tìm thấy gói chụp/sản phẩm với ID ${item.product_id}` });
            }
            
            // KIỂM TRA TỒN KHO CHO SẢN PHẨM VẬT LÝ
            if (productObj.is_physical && productObj.stock < (item.quantity || 1)) {
              return res.status(400).json({ success: false, message: `Sản phẩm "${productObj.name}" chỉ còn ${productObj.stock} sản phẩm trong kho!` });
            }
            
            itemUnitPrice += productObj.price;
            itemPhotographerId = productObj.user_id.toString();
            itemName += productObj.name;
            if (productObj.is_physical) hasPhysicalItem = true;
          } else if (type === 'service' || item.service_id) {
            serviceObj = isFromDatabaseCart && item.service_id ? item.service_id : await Service.findById(item.service_id);
            if (!serviceObj) {
              return res.status(404).json({ success: false, message: `Không tìm thấy gói dịch vụ với ID ${item.service_id}` });
            }
            itemUnitPrice += serviceObj.price;
            itemPhotographerId = serviceObj.user_id.toString();
            itemName += serviceObj.name;
          }

          // Nếu có frame_id (Dịch vụ làm khung ảnh)
          if (item.frame_id) {
            frameObj = await Frame.findById(item.frame_id);
            if (!frameObj) {
              return res.status(404).json({ success: false, message: `Không tìm thấy mẫu khung ảnh với ID ${item.frame_id}` });
            }
            
            const sizeConfig = frameObj.sizes.find(s => s.size_label === item.frame_size);
            if (!sizeConfig) {
              return res.status(400).json({ success: false, message: `Mẫu khung không hỗ trợ kích thước ${item.frame_size}` });
            }
            
            framePrice = sizeConfig.price;
            itemUnitPrice += framePrice;
            hasPhysicalItem = true; // In khung ảnh cần ship hàng vật lý
            
            const framePhotoId = frameObj.photographer_id.toString();
            if (itemPhotographerId && itemPhotographerId !== framePhotoId) {
              return res.status(400).json({ success: false, message: "Các sản phẩm trong giỏ hàng phải thuộc về cùng một Nhiếp ảnh gia!" });
            }
            itemPhotographerId = framePhotoId;
            
            if (itemName) {
              itemName += ` + Khung ${frameObj.name} (${item.frame_size})`;
            } else {
              itemName += `In khung ${frameObj.name} (${item.frame_size})`;
            }
          }

          if (!itemPhotographerId) {
            return res.status(400).json({ success: false, message: "Không xác định được Nhiếp ảnh gia sở hữu sản phẩm/dịch vụ!" });
          }

          // Kiểm tra tính độc quyền của giỏ hàng (chỉ mua sản phẩm của 1 photographer tại một thời điểm)
          if (photographerId && photographerId !== itemPhotographerId) {
            return res.status(400).json({
              success: false,
              message: "Giỏ hàng độc quyền! Bạn chỉ được phép thanh toán sản phẩm/dịch vụ của duy nhất 1 Nhiếp ảnh gia tại một thời điểm."
            });
          }
          photographerId = itemPhotographerId;

          resolvedItems.push({
            item_type: type,
            product_id: productObj ? productObj._id : null,
            service_id: serviceObj ? serviceObj._id : null,
            photo_id: item.photo_id || null,
            image_url: item.image_url || null,
            album_id: item.album_id || null,
            frame_id: frameObj ? frameObj._id : null,
            frame_size: item.frame_size || null,
            frame_price: framePrice,
            booking_date: item.booking_date || null,
            quantity: item.quantity || 1,
            unit_price: itemUnitPrice,
            name: itemName || "Dịch vụ AuraShot",
            is_physical: !!(frameObj || (productObj && productObj.is_physical))
          });

        }

        if (hasPhysicalItem && !shipping_address) {
          return res.status(400).json({ success: false, message: "Vui lòng nhập địa chỉ nhận hàng để giao hàng vật lý!" });
        }

          // logic kiểm tra trùng lặp lịch chụp
        const { checkPhotographerConflict } = require('../utils/scheduleHelper');
        for (const item of resolvedItems) {
          if (item.item_type === 'service' && item.booking_date) {
            const conflictResult = await checkPhotographerConflict(photographerId, item.booking_date, { userId: req.user.id });
            if (conflictResult.conflict) {
              return res.status(409).json({
                success: false,
                message: conflictResult.reason || `Khung giờ chụp ${item.booking_date} không khả dụng. Vui lòng chọn khung giờ khác!`
              });
            }
          }
        }

        // 2. Tính tổng tiền của đơn hàng
        let itemsTotalAmount = 0;
        resolvedItems.forEach(item => {
          itemsTotalAmount += item.unit_price * item.quantity;
        });

        let totalAmount = itemsTotalAmount + (shipping_fee ? Number(shipping_fee) : 0);
        let depositAmount = 0;
        let remainingAmount = 0;

        if (hasPhysicalItem) {
          if (payment_method === 'cod') {
            depositAmount = 0;
            remainingAmount = totalAmount;
          } else {
            depositAmount = Math.round(itemsTotalAmount * 0.3) + (shipping_fee ? Number(shipping_fee) : 0);
            remainingAmount = totalAmount - depositAmount;
          }
        } else {
          if (payment_method === 'cod') {
            return res.status(400).json({ success: false, message: "Gói dịch vụ không hỗ trợ thanh toán khi nhận hàng!" });
          }
          depositAmount = Math.round(itemsTotalAmount * 0.3) + (shipping_fee ? Number(shipping_fee) : 0);
          remainingAmount = totalAmount - depositAmount;
        }

        // Lấy tỉ lệ hoa hồng chủ động của thợ ảnh chụp mặc định là 10% nếu chưa cấu hình
        const photographerProfile = await PhotographerProfile.findOne({ 
          user_id: photographerId
        });
        if (!photographerProfile || !photographerProfile.bank_name || !photographerProfile.bank_account_number || !photographerProfile.bank_account_name) {
          return res.status(400).json({ success: false, message: "Thợ ảnh chưa cấu hình thông tin ngân hàng thanh toán. Vui lòng thử lại sau!" });
        }

        // 3. Tạo mã orderCode dạng số duy nhất cho PayOS
        let orderCode = Math.floor(100000 + Math.random() * 90000000);
        let existingOrder = await Order.findOne({ orderCode });
        while (existingOrder) {
          orderCode = Math.floor(100000 + Math.random() * 90000000);
          existingOrder = await Order.findOne({ orderCode });
        }

        // 3b. Chuẩn bị mảng selected_images cho đơn hàng
        const selected_images = resolvedItems.map(item => ({
          image_url: item.image_url,
          customer_note: note || ""
        })).filter(img => img.image_url);
        const bookingItem = resolvedItems.find(item => item.booking_date);
        const booking_date = bookingItem ? bookingItem.booking_date : null;

        // PHÂN CHIA ĐƠN HÀNG (SPLIT ORDER)
        const physicalItems = resolvedItems.filter(i => i.is_physical);
        const digitalItems = resolvedItems.filter(i => !i.is_physical);

        let newOrder = null; // Đơn hàng chính để thanh toán (Primary Order)
        let secondaryOrder = null;

        // Helper để tính tổng tiền của một danh sách items
        const calculateTotals = (itemsList, includeShipping = false) => {
          let sum = 0;
          itemsList.forEach(i => { sum += i.unit_price * i.quantity; });
          const totalAmt = sum + (includeShipping && shipping_fee ? Number(shipping_fee) : 0);
          let depAmt = 0;
          let remAmt = 0;
          if (payment_method !== 'cod') {
            depAmt = Math.round(sum * 0.3) + (includeShipping && shipping_fee ? Number(shipping_fee) : 0);
            remAmt = totalAmt - depAmt;
          } else {
            remAmt = totalAmt;
          }
          return { totalAmount: totalAmt, depositAmount: depAmt, remainingAmount: remAmt };
        };

        const createOrderObject = async (itemsList, isPrimary, includeShipping) => {
          let oCode = Math.floor(100000 + Math.random() * 90000000);
          while (await Order.findOne({ orderCode: oCode })) {
            oCode = Math.floor(100000 + Math.random() * 90000000);
          }
          const { totalAmount: tAmt, depositAmount: dAmt, remainingAmount: rAmt } = calculateTotals(itemsList, includeShipping);
          
          return await Order.create({
            user_id: userId,
            photographer_id: photographerId,
            orderCode: isPrimary ? orderCode : oCode, // Đơn chính giữ nguyên orderCode đã gen từ trước
            rule_id: null,
            customer_name,
            phone,
            shipping_address: includeShipping ? (shipping_address || null) : null,
            total_amount: tAmt,
            deposit_amount: dAmt,
            remaining_amount: rAmt,
            status: 'Pending',
            selected_images: includeShipping ? [] : selected_images,
            note: note || "",
            booking_date: includeShipping ? null : booking_date,
            related_order_id: null // Sẽ gán sau
          });
        };

        if (physicalItems.length > 0 && digitalItems.length > 0) {
          // Tách thành 2 đơn
          newOrder = await createOrderObject(digitalItems, true, false); // Đơn chính là Dịch vụ
          secondaryOrder = await createOrderObject(physicalItems, false, true); // Đơn phụ là Hàng vật lý
          
          newOrder.related_order_id = secondaryOrder._id;
          secondaryOrder.related_order_id = newOrder._id;
          await newOrder.save();
          await secondaryOrder.save();
        } else if (physicalItems.length > 0) {
          // Chỉ có hàng vật lý
          newOrder = await createOrderObject(physicalItems, true, true);
        } else {
          // Chỉ có dịch vụ số
          newOrder = await createOrderObject(digitalItems, true, false);
        }

        // 5. Tạo các dòng chi tiết đơn hàng (OrderItem) và Trừ tồn kho
        for (const item of resolvedItems) {
          const targetOrderId = (secondaryOrder && item.is_physical) ? secondaryOrder._id : newOrder._id;
          
          await OrderItem.create({
            order_id: targetOrderId,
            item_type: item.item_type,
            product_id: item.product_id,
            service_id: item.service_id,
            photo_id: item.photo_id,
            image_url: item.image_url,
            album_id: item.album_id,
            frame_id: item.frame_id,
            frame_size: item.frame_size,
            frame_price: item.frame_price,
            quantity: item.quantity,
            unit_price: item.unit_price
          });

          // TRỪ TỒN KHO SẢN PHẨM VẬT LÝ
          if (item.item_type === 'product' && item.product_id) {
             const prod = await Product.findById(item.product_id);
             if (prod && prod.is_physical) {
                await Product.findByIdAndUpdate(item.product_id, {
                  $inc: { stock: -item.quantity }
                });
             }
          }
        }

        // 6. Tạo link thanh toán VietQR tĩnh (P2P)
        let paymentUrl = null;

        if (depositAmount > 0) {
          const bankName = encodeURIComponent(photographerProfile.bank_name);
          const accountNumber = encodeURIComponent(photographerProfile.bank_account_number);
          const accountName = encodeURIComponent(photographerProfile.bank_account_name);
          const qrCodeUrl = `https://img.vietqr.io/image/${bankName}-${accountNumber}-compact2.jpg?amount=${depositAmount}&addInfo=${orderCode}&accountName=${accountName}`;
          
          const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
          const paymentParams = new URLSearchParams({
            payment: 'pending',
            orderId: String(newOrder._id),
            orderCode: String(orderCode),
            amount: String(depositAmount),
            qrCode: qrCodeUrl,
            bankName: photographerProfile.bank_name,
            accountNumber: photographerProfile.bank_account_number,
            accountName: photographerProfile.bank_account_name,
            description: String(orderCode)
          });
          paymentUrl = `${frontendUrl}/customer/payment-status?${paymentParams.toString()}`;
        }

        // Chỉ xóa giỏ
        if (isFromDatabaseCart && dbCart) {
          dbCart.items = [];
          await dbCart.save();
        }

        // Thông báo cho thợ ảnh về đơn hàng mới (Pending) vì khách sẽ chuyển khoản trực tiếp
        if (photographerId) {
          const newNotification = await Notification.create({
            user_id: photographerId,
            type: 'new_order',
            order_id: newOrder._id,
            target_url: `/photographer/orders`,
            title: "Đơn hàng mới (Chờ thanh toán)",
            message: `Khách hàng ${customer_name || ''} đã đặt đơn hàng #${orderCode}. Vui lòng kiểm tra tài khoản ngân hàng và xác nhận.`
          });
          
          if (req.app.locals.io) {
            req.app.locals.io.to(photographerId.toString()).emit('notification', newNotification);
          }
        }

        res.status(201).json({
          success: true,
          message: depositAmount > 0 ? "Tạo đơn hàng và mã QR thanh toán thành công!" : "Đặt hàng COD thành công!",
          order_id: newOrder._id,
          orderCode,
          total_amount: totalAmount,
          deposit_amount: depositAmount,
          remaining_amount: remainingAmount,
          paymentUrl
        });

      } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi xử lý đặt hàng PayOS: " + error.message });
      }
    };

    // Xác nhận đã nhận được tiền thanh toán (dành cho Photographer)
    exports.confirmPayment = async (req, res) => {
      try {
        const { id } = req.params;
        const photographerId = req.user.id;

        const order = await Order.findById(id);
        if (!order) {
          return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng!" });
        }

        // Kiểm tra xem người xác nhận có phải là thợ ảnh của đơn hàng không
        if (order.photographer_id && order.photographer_id.toString() !== photographerId && req.user.role !== 'admin') {
          return res.status(403).json({ success: false, message: "Bạn không có quyền xác nhận thanh toán cho đơn hàng này!" });
        }

        if (order.status !== 'Pending' && order.status !== 'Verifying') {
          return res.status(400).json({ success: false, message: "Chỉ có thể xác nhận thanh toán cho đơn hàng ở trạng thái Pending hoặc Verifying!" });
        }

        order.status = 'Paid';
        await order.save();

        // Đồng bộ trạng thái cho đơn hàng liên quan (Mixed Cart Split)
        if (order.related_order_id) {
          const relatedOrder = await Order.findById(order.related_order_id);
          if (relatedOrder && (relatedOrder.status === 'Pending' || relatedOrder.status === 'Verifying')) {
            relatedOrder.status = 'Paid';
            await relatedOrder.save();
          }
        }

        if (order.booking_date) {
          await Order.updateMany(
            { _id: { $ne: order._id }, photographer_id: order.photographer_id, booking_date: order.booking_date, status: 'Pending' },
            { $set: { status: 'Cancelled' } }
          );
        }

        const orderCode = order.orderCode || order._id.toString().slice(-8).toUpperCase();

        // Bắn thông báo chuông cho khách hàng
        if (order.user_id) {
          await Notification.create({
            user_id: order.user_id,
            type: 'order',
            order_id: order._id,
            target_url: '/user/order-history',
            title: '✅ Đã xác nhận thanh toán',
            message: `Nhiếp ảnh gia đã xác nhận nhận đủ tiền thanh toán cho đơn hàng #${orderCode}. Lịch chụp của bạn đã sẵn sàng!`
          });
        }

        return res.status(200).json({ success: true, message: "Đã xác nhận thanh toán thành công. Đơn hàng chuyển sang trạng thái Paid.", data: order });
      } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi xác nhận thanh toán: " + error.message });
      }
    };

    // Từ chối nhận tiền thanh toán (dành cho Photographer khi chưa nhận được tiền)
    exports.rejectPayment = async (req, res) => {
      try {
        const { id } = req.params;
        const photographerId = req.user.id;
        const { reason } = req.body;

        const order = await Order.findById(id);
        if (!order) {
          return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng!" });
        }

        if (order.photographer_id && order.photographer_id.toString() !== photographerId && req.user.role !== 'admin') {
          return res.status(403).json({ success: false, message: "Bạn không có quyền thao tác trên đơn hàng này!" });
        }

        if (order.status !== 'Verifying' && order.status !== 'Pending') {
          return res.status(400).json({ success: false, message: "Chỉ có thể từ chối thanh toán đơn hàng đang ở trạng thái Verifying hoặc Pending!" });
        }

        order.status = 'Pending';
        if (reason) {
          order.payment_reject_reason = reason;
        }
        await order.save();

        // Đồng bộ trạng thái cho đơn hàng liên quan (Mixed Cart Split)
        if (order.related_order_id) {
          const relatedOrder = await Order.findById(order.related_order_id);
          if (relatedOrder && relatedOrder.status === 'Verifying') {
            relatedOrder.status = 'Pending';
            await relatedOrder.save();
          }
        }

        const orderCode = order.orderCode || order._id.toString().slice(-8).toUpperCase();
        const reasonText = reason ? `\n📝 Lý do từ thợ ảnh: "${reason}"` : '';

        // Bắn thông báo chuông cảnh báo cho khách hàng
        if (order.user_id) {
          await Notification.create({
            user_id: order.user_id,
            type: 'order',
            order_id: order._id,
            target_url: '/user/order-history',
            title: '⚠️ Chưa nhận được thanh toán',
            message: `Nhiếp ảnh gia thông báo chưa nhận được khoản chuyển khoản cho đơn hàng #${orderCode}.${reasonText}\nVui lòng kiểm tra lại sao kê ngân hàng hoặc thực hiện thanh toán lại.`
          });
        }

        return res.status(200).json({
          success: true,
          message: "Đã báo chưa nhận được tiền. Thông báo cảnh báo đã gửi tới khách hàng.",
          data: order
        });
      } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi từ chối thanh toán: " + error.message });
      }
    };



    // Lấy danh sách các đơn hàng của khách mua tại gian hàng của thợ ảnh đang đăng nhập
    exports.getPhotographerOrders = async (req, res) => {
      try {
        const photographerId = req.user.id;

        // Tìm trực tiếp các Order thuộc về Photographer này
        const orders = await Order.find({ photographer_id: photographerId })
          .populate('user_id', 'full_name email phone')
          .sort({ createdAt: -1 });

        const data = [];
        for (const order of orders) {
          const items = await OrderItem.find({ order_id: order._id })
            .populate('product_id')
            .populate('service_id')
            .populate('frame_id');

          data.push({
            order_id: order._id,
            orderCode: order.orderCode,
            customer_name: order.customer_name,
            phone: order.phone,
            shipping_address: order.shipping_address,
            total_amount: order.total_amount,
            status: order.status,
            booking_date: order.booking_date || null,
            note: order.note,
            createdAt: order.createdAt,
            delivered_urls: order.delivered_urls || [],
            proof_of_delivery_link: order.proof_of_delivery_link || null,
            require_digital_delivery: items.some(item => 
              ['service', 'photo', 'album'].includes(item.item_type) || 
              (item.item_type === 'product' && item.product_id && !item.product_id.is_physical)
            ),
            items: items.map(item => {
              let name = "";
              if (item.item_type === 'service' && item.service_id) {
                name = item.service_id.name;
              } else if (item.product_id) {
                name = item.product_id.name;
              } else if (item.frame_id) {
                name = `In khung ${item.frame_id.name} (${item.frame_size})`;
              } else {
                name = "Dịch vụ in ấn";
              }
              return {
                product_id: item.product_id ? item.product_id._id : null,
                service_id: item.service_id ? item.service_id._id : null,
                item_type: item.item_type,
                name: name,
                price: item.unit_price,
                quantity: item.quantity,
                album_id: item.album_id,
                image_url: item.image_url,
                frame_id: item.frame_id ? item.frame_id._id : null,
                frame_size: item.frame_size,
                frame_price: item.frame_price,
                auto_delete_album_days: item.service_id ? item.service_id.auto_delete_album_days : null
              };
            })
          });
        }

        res.status(200).json({
          success: true,
          data
        });
      } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lấy danh sách đơn hàng thợ ảnh: " + error.message });
      }
    };

    // Cập nhật trạng thái xử lý đơn hàng của thợ ảnh
    exports.updateOrderStatus = async (req, res) => {
      try {
        const { id } = req.params;
        const { status, delivered_urls, proof_of_delivery_link } = req.body;
        const photographerId = req.user.id;

        if (!['Pending', 'Deposit Paid', 'Paid', 'Processing', 'Delivered', 'Completed', 'Cancelled'].includes(status)) {
          return res.status(400).json({ success: false, message: "Trạng thái đơn hàng cập nhật không hợp lệ!" });
        }

        const order = await Order.findById(id);
        if (!order) {
          return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng yêu cầu!" });
        }

        // Kiểm tra chuyển đổi trạng thái (State Machine)
        const allowedTransitions = {
          'Pending': ['Deposit Paid', 'Paid', 'Cancelled'],
          'Deposit Paid': ['Processing', 'Cancelled'],
          'Paid': ['Processing', 'Delivered', 'Cancelled'],
          'Processing': ['Delivered', 'Cancelled'],
          'Delivered': ['Completed'],
          'Completed': [],
          'Cancelled': []
        };

        if (order.status !== status && !allowedTransitions[order.status]?.includes(status)) {
          return res.status(400).json({ 
            success: false, 
            message: `Lỗi logic: Không thể chuyển đơn hàng từ trạng thái '${order.status}' sang '${status}'!` 
          });
        }

        // Kiểm tra quyền sở hữu đơn hàng
        if (order.photographer_id && order.photographer_id.toString() !== photographerId && req.user.role !== 'admin') {
          return res.status(403).json({ success: false, message: "Bạn không có quyền cập nhật trạng thái đơn hàng này!" });
        }

        // Chốt chặn Backend: Khi chuyển trạng thái sang Delivered
        if (status === 'Delivered') {
          const urlsToCheck = delivered_urls || order.delivered_urls;
          const proofToCheck = proof_of_delivery_link || order.proof_of_delivery_link;

          if (!urlsToCheck || !Array.isArray(urlsToCheck) || urlsToCheck.length === 0 || !proofToCheck) {
            return res.status(400).json({
              success: false,
              message: "Vui lòng cung cấp đầy đủ danh sách link ảnh bàn giao (delivered_urls) và link chứng từ bàn giao (proof_of_delivery_link) trước khi hoàn tất đơn."
            });
          }
          order.delivered_urls = urlsToCheck;
          order.proof_of_delivery_link = proofToCheck;
        }

        if(status === 'Completed' && ['Paid', 'Deposit Paid', 'Delivered'].includes(order.status)){
          const photographerId = order.photographer_id;
        }

        // Hoàn lại tồn kho nếu đơn hàng bị hủy
        if (status === 'Cancelled' && order.status !== 'Cancelled') {
          const orderItems = await OrderItem.find({ order_id: order._id });
          for (const item of orderItems) {
            if (item.item_type === 'product' && item.product_id) {
              const prod = await Product.findById(item.product_id);
              if (prod && prod.is_physical) {
                await Product.findByIdAndUpdate(item.product_id, {
                  $inc: { stock: item.quantity }
                });
              }
            }
          }
        }

        order.status = status;
        await order.save();

        res.status(200).json({
          success: true,
          message: "Cập nhật trạng thái đơn hàng thành công!",
          data: order
        });
      } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi xác nhận đã nhận hàng: " + error.message });
    }
};

// API Cập nhật/Điều chỉnh thời gian chụp (dành cho Photographer)
exports.updateBookingTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { booking_date } = req.body;
    const photographerId = req.user.id;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng!" });
    }

    if (order.photographer_id && order.photographer_id.toString() !== photographerId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền chỉnh sửa đơn hàng này!" });
    }

    if (!booking_date || typeof booking_date !== 'string') {
      return res.status(400).json({ success: false, message: "Thời gian hẹn chụp không hợp lệ!" });
    }

    order.booking_date = booking_date.trim();
    await order.save();

    // Cập nhật booking_date cho các order_items tương ứng nếu có
    await OrderItem.updateMany(
      { order_id: order._id, item_type: 'service' },
      { $set: { booking_date: booking_date.trim() } }
    );

    return res.status(200).json({
      success: true,
      message: "Đã cập nhật thời gian buổi chụp thành công!",
      data: order
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi cập nhật thời gian chụp: " + error.message });
  }
};

// API đánh dấu đơn hàng là Chờ xác nhận (khi khách bấm "Tôi đã thanh toán")
exports.markOrderAsVerifying = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng!" });
        }

        // Nếu đơn hàng có gắn user, kiểm tra xem có đúng user đó không
        if (order.user_id && order.user_id.toString() !== userId) {
             return res.status(403).json({ success: false, message: "Không có quyền thực hiện!" });
        }

        if (order.status !== 'Pending') {
             return res.status(400).json({ success: false, message: "Chỉ đơn hàng chờ thanh toán mới có thể đánh dấu đã thanh toán." });
        }

        order.status = 'Verifying';
        await order.save();

        res.status(200).json({ success: true, message: "Đã gửi thông báo xác nhận thanh toán thành công!", data: order });
    } catch (error) {
        console.error("Lỗi markOrderAsVerifying:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi xác nhận thanh toán." });
    }
};

    // API Bàn giao File Order (POST /api/orders/:id/delivery)
    exports.deliverOrder = async (req, res) => {
      try {
        const { id } = req.params;
        const { delivered_urls, proof_of_delivery_link } = req.body;
        const photographerId = req.user.id;

        // Phân quyền: Chỉ cho phép photographer
        if (req.user.role !== 'photographer') {
          return res.status(403).json({
            success: false,
            message: "Chỉ thợ ảnh (photographer) mới có quyền thực hiện bàn giao file ảnh!"
          });
        }

        const order = await Order.findById(id);
        if (!order) {
          return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng yêu cầu!" });
        }

        // Kiểm tra xem đơn hàng có chứa sản phẩm số (cần link Drive) hay không
        const orderItems = await OrderItem.find({ order_id: id }).populate('product_id');
        let requireDigitalDelivery = false;
        
        for (const item of orderItems) {
            if (item.item_type === 'service' || item.item_type === 'photo' || item.item_type === 'album') {
                requireDigitalDelivery = true;
                break;
            }
            if (item.item_type === 'product' && item.product_id && !item.product_id.is_physical) {
                requireDigitalDelivery = true;
                break;
            }
        }

        if (requireDigitalDelivery) {
            if (!delivered_urls || !Array.isArray(delivered_urls) || delivered_urls.length === 0) {
              return res.status(400).json({ success: false, message: "Đơn hàng này có chứa sản phẩm số/dịch vụ. Vui lòng cung cấp/tải lên danh sách ảnh bàn giao cho khách!" });
            }
        }
        
        if (!proof_of_delivery_link) {
           return res.status(400).json({ success: false, message: "Vui lòng cung cấp link chứng từ bàn giao (proof_of_delivery_link)!" });
        }


        // Kiểm tra xem đơn hàng có phải của thợ ảnh này không
        if (order.photographer_id && order.photographer_id.toString() !== photographerId) {
          return res.status(403).json({ 
            success: false, 
            message: "Bạn không có quyền thực hiện bàn giao file cho đơn hàng này!" 
          });
        }

        // Cập nhật trạng thái đơn hàng thành Delivered và lưu các link bàn giao
        order.status = 'Delivered';
        order.delivered_urls = delivered_urls;
        order.proof_of_delivery_link = proof_of_delivery_link;
        await order.save();

        return res.status(200).json({
          success: true,
          message: "Bàn giao file sản phẩm hoàn thiện thành công!",
          data: order
        });

      } catch (error) {
        console.error("❌ Lỗi API bàn giao file:", error);
        return res.status(500).json({
          success: false,
          message: "Lỗi hệ thống khi thực hiện bàn giao file: " + error.message
        });
      }
    };

    // [GHN] Lấy danh sách Tỉnh/Thành phố cho dropdown địa chỉ
    exports.getProvinces = async (req, res) => {
      try {
        const provinces = await ghnService.getProvinces();
        const data = provinces.map(item => ({ ...item, ProvinceID: item.province_id, ProvinceName: item.province_name }));
        return res.status(200).json({ success: true, count: data.length, data });
      } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách tỉnh thành: ' + error.message });
      }
    };

    // [GHN] Lấy danh sách Quận/Huyện theo tỉnh
    exports.getDistricts = async (req, res) => {
      try {
        const { province_id } = req.query;
        if (!province_id) {
          return res.status(400).json({ success: false, message: 'Thiếu province_id trong query' });
        }
        const districts = await ghnService.getDistricts(province_id);
        const data = districts.map(item => ({ ...item, DistrictID: item.district_id, DistrictName: item.district_name }));
        return res.status(200).json({ success: true, count: data.length, data });
      } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách quận huyện: ' + error.message });
      }
    };

    // [GHN] Lấy danh sách Phường/Xã theo quận
    exports.getWards = async (req, res) => {
      try {
        const { district_id } = req.query;
        if (!district_id) {
          return res.status(400).json({ success: false, message: 'Thiếu district_id trong query' });
        }
        const wards = await ghnService.getWards(district_id);
        const data = wards.map(item => ({ ...item, WardCode: item.ward_code, WardName: item.ward_name }));
        return res.status(200).json({ success: true, count: data.length, data });
      } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách phường xã: ' + error.message });
      }
    };

    // [GHN] Tính phí vận chuyển thực tế (thay thế giả lập cũ)
    exports.calculateFee = async (req, res) => {
      try {
        const { store_id, customer_address, items, product_ids, to_district_id, to_ward_code, weight, insurance_value } = req.body;

        // ─── Bước 1: Phân loại sản phẩm — Nếu toàn digital thì phí = 0 ──────────
        let isOnlyServices = false;
        if (items && Array.isArray(items) && items.length > 0) {
          isOnlyServices = items.every(item => item.item_type === 'service');
        }
        
        let hasPhysicalItem = true;
        if (product_ids && Array.isArray(product_ids) && product_ids.length > 0) {
          const products = await Product.find({ _id: { $in: product_ids } }).select('is_physical name');
          hasPhysicalItem = products.some(p => p.is_physical === true);
        }

        if (isOnlyServices || !hasPhysicalItem) {
          return res.status(200).json({
            success: true,
            message: 'Đơn hàng chỉ gồm dịch vụ số, không cần vận chuyển!',
            data: {
              shipping_fee: 0,
              estimated_delivery: 'Giao ngay qua link tải / Trực tuyến',
              carrier: 'Digital Delivery',
              is_physical: false
            }
          });
        }

        // ─── Bước 2: Có sản phẩm vật lý — tính phí ship thực tế hoặc giả lập ──────────
        if (to_district_id && to_ward_code) {
          // Dùng GHN thực tế
          let feeData;
          let usedFallback = false;
          try {
            feeData = await ghnService.calculateShippingFee({
              toDistrictId: to_district_id,
              toWardCode: to_ward_code,
              weight: weight || 500,
              insuranceValue: insurance_value || 0
            });
          } catch (ghnError) {
            console.warn('[GHN] API không khả dụng, dùng phí fallback:', ghnError.message);
            feeData = ghnService.getFallbackFee(to_district_id);
            usedFallback = true;
          }

          return res.status(200).json({
            success: true,
            message: usedFallback
              ? 'Phí vận chuyển ước tính (GHN tạm thời không khả dụng)'
              : 'Tính phí vận chuyển GHN thành công!',
            data: {
              shipping_fee: feeData.total,
              estimated_delivery: feeData.leadtime,
              carrier: usedFallback ? 'Giao Hàng Nhanh (Ước tính)' : 'Giao Hàng Nhanh (GHN)',
              is_physical: true,
              is_fallback: usedFallback
            }
          });
        } else {
          // Dùng giả lập Zone Simulation như trước
          if (!customer_address) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập địa chỉ giao hàng (customer_address) hoặc mã vùng GHN (to_district_id, to_ward_code) để tính phí ship vật lý!" });
          }

          let storeAddress = "Hà Nội"; 
          if (store_id) {
            const profile = await PhotographerProfile.findOne({ user_id: store_id });
            if (profile && profile.storeName) {
              storeAddress = profile.storeName;
            }
          }

          const shippingInfo = calculateShippingFee(storeAddress, customer_address);
          return res.status(200).json({
            success: true,
            message: "Tính phí vận chuyển thành công! (Zone Simulation)",
            data: {
              shipping_fee: shippingInfo.fee,
              estimated_delivery: shippingInfo.estimatedDelivery,
              carrier: "Giao Hàng Nhanh (GHN) - Zone Simulation",
              regionType: shippingInfo.regionType,
              is_physical: true
            }
          });
        }
      } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi tính phí vận chuyển: ' + error.message });
      }
    };
    // Lấy lịch sử đơn hàng của khách mua (người dùng đang đăng nhập)
    exports.getCustomerOrderHistory = async (req, res) => {
      try {
        const userId = req.user.id;

        // Tìm các Order có user_id bằng ID của user đang đăng nhập
        const orders = await Order.find({ user_id: userId })
          .populate('photographer_id', 'full_name email phone')
          .sort({ createdAt: -1 });

        const data = [];
        for (const order of orders) {
          const items = await OrderItem.find({ order_id: order._id })
            .populate('product_id')
            .populate('service_id')
            .populate('frame_id');

          data.push({
            order_id: order._id,
            orderCode: order.orderCode,
            photographer: order.photographer_id ? {
              id: order.photographer_id._id,
              full_name: order.photographer_id.full_name,
              email: order.photographer_id.email,
              phone: order.photographer_id.phone
            } : null,
            customer_name: order.customer_name,
            phone: order.phone,
            shipping_address: order.shipping_address,
            total_amount: order.total_amount,
            status: order.status,
            note: order.note,
            booking_date: order.booking_date,
            createdAt: order.createdAt,
            delivered_urls: order.delivered_urls || [],
            proof_of_delivery_link: order.proof_of_delivery_link || null,
            require_digital_delivery: items.some(item => 
              ['service', 'photo', 'album'].includes(item.item_type) || 
              (item.item_type === 'product' && item.product_id && !item.product_id.is_physical)
            ),
            items: items.map(item => {
              let name = "";
              if (item.item_type === 'service' && item.service_id) {
                name = item.service_id.name;
              } else if (item.product_id) {
                name = item.product_id.name;
              } else if (item.frame_id) {
                name = `In khung ${item.frame_id.name} (${item.frame_size})`;
              } else {
                name = "Dịch vụ in ấn";
              }
              return {
                product_id: item.product_id ? item.product_id._id : null,
                service_id: item.service_id ? item.service_id._id : null,
                item_type: item.item_type,
                name: name,
                price: item.unit_price,
                quantity: item.quantity,
                album_id: item.album_id,
                image_url: item.image_url,
                frame_id: item.frame_id ? item.frame_id._id : null,
                frame_size: item.frame_size,
                frame_price: item.frame_price
              };
            })
          });
        }

        res.status(200).json({
          success: true,
          data
        });
      } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lấy lịch sử đơn hàng khách hàng: " + error.message });
      }
    };


// 1. Lấy chi tiết 1 đơn hàng cụ thể
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate('photographer_id', 'full_name email phone avatar_url');
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng!" });
    
    // Kiểm tra quyền: Chỉ chủ đơn, thợ ảnh nhận đơn, hoặc Admin mới được xem
    const isOwner = order.user_id && order.user_id.toString() === req.user.id;
    const isPhotographer = order.photographer_id && (order.photographer_id._id || order.photographer_id).toString() === req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isPhotographer && !isAdmin) {
       return res.status(403).json({ success: false, message: "Bạn không có quyền xem đơn hàng này!" });
    }

    const items = await OrderItem.find({ order_id: order._id })
      .populate('product_id', 'name image_url type price is_physical')
      .populate('service_id', 'name image_url type price duration')
      .populate('frame_id', 'name price');

    return res.status(200).json({ success: true, data: { order, items } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi khi lấy chi tiết đơn hàng: " + error.message });
  }
};

// 2. Khách hàng chủ động hủy đơn hàng (Chỉ được hủy khi Pending)
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng!" });
    
    if (order.user_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Bạn không có quyền hủy đơn hàng này!" });
    }

    if (order.status.toLowerCase() !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: "Bạn chỉ có thể hủy đơn hàng khi chưa thanh toán (Pending). Đơn đã thanh toán không thể tự hủy, vui lòng liên hệ thợ ảnh!" 
      });
    }

    order.status = 'Cancelled';
    order.cancelled_reason = req.body.reason || 'Khách hàng chủ động hủy đơn';
    await order.save();

    // Đồng bộ hủy đơn hàng liên quan (Mixed Cart Split)
    if (order.related_order_id) {
      const relatedOrder = await Order.findById(order.related_order_id);
      if (relatedOrder && relatedOrder.status.toLowerCase() === 'pending') {
        relatedOrder.status = 'Cancelled';
        relatedOrder.cancelled_reason = req.body.reason || 'Khách hàng chủ động hủy đơn (Hủy theo đơn gốc)';
        await relatedOrder.save();
      }
    }

    // Thông báo cho thợ ảnh
    if (order.photographer_id) {
       const newNotification = await Notification.create({
         user_id: order.photographer_id,
         type: 'cancelled_order',
         order_id: order._id,
         target_url: `/photographer/dashboard`,
         title: "Đơn hàng bị hủy",
         message: `Khách hàng ${order.customer_name || ''} đã hủy đơn hàng #${order.orderCode} (Chưa thanh toán).`
       });
       
       if (req.app.locals.io) {
         req.app.locals.io.to(order.photographer_id.toString()).emit('notification', newNotification);
       }
    }

    return res.status(200).json({ success: true, message: "Hủy đơn hàng thành công!", data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi khi hủy đơn hàng: " + error.message });
  }
};

// 3. Khách hàng xác nhận đã nhận hàng / hoàn tất dịch vụ
exports.confirmReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng!" });
    
    if (order.user_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Bạn không có quyền thao tác trên đơn hàng này!" });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: "Chỉ có thể xác nhận hoàn tất khi đơn hàng đang ở trạng thái Đã bàn giao (Delivered)!" });
    }

    order.status = 'Completed';
    await order.save();

    // Tự động giải ngân tiền (Escrow Release)
    const photographerId = order.photographer_id;
    const photographerRevenue = order.total_amount;

    if (photographerId) {
      const newNotification = await Notification.create({
         user_id: photographerId,
         type: 'new_order', // Or generic order update
         order_id: order._id,
         target_url: `/photographer/dashboard`,
         title: "Đơn hàng hoàn tất",
         message: `Khách hàng ${order.customer_name || ''} đã xác nhận hoàn tất đơn hàng #${order.orderCode}.`
       });
       
       if (req.app.locals.io) {
         req.app.locals.io.to(photographerId.toString()).emit('notification', newNotification);
       }
    }

    return res.status(200).json({ success: true, message: "Xác nhận hoàn tất đơn hàng thành công!", data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi khi xác nhận hoàn tất đơn hàng: " + error.message });
  }
};

// 4. Khách hàng xác nhận "Tôi đã chuyển khoản" để chuyển đơn sang Verifying
exports.markOrderAsVerifying = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng!" });

    if (order.user_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Bạn không có quyền thao tác trên đơn hàng này!" });
    }

    if (order.status !== 'Pending') {
      return res.status(400).json({ success: false, message: "Chỉ có thể gửi xác nhận khi đơn hàng đang ở trạng thái Pending!" });
    }

    order.status = 'Verifying';
    await order.save();

    // Đồng bộ trạng thái cho đơn hàng liên quan (Mixed Cart Split)
    if (order.related_order_id) {
      const relatedOrder = await Order.findById(order.related_order_id);
      if (relatedOrder && relatedOrder.status === 'Pending') {
        relatedOrder.status = 'Verifying';
        await relatedOrder.save();
      }
    }

    const orderCode = order.orderCode || order._id.toString().slice(-8).toUpperCase();

    // Bắn thông báo chuông cho thợ ảnh
    if (order.photographer_id) {
      await Notification.create({
        user_id: order.photographer_id,
        type: 'new_order',
        order_id: order._id,
        target_url: '/photographer/orders',
        title: '💳 Khách hàng đã chuyển khoản',
        message: `Khách hàng ${order.customer_name || ''} vừa bấm xác nhận đã chuyển khoản cho đơn hàng #${orderCode}. Vui lòng kiểm tra tài khoản và xác nhận.`
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đã gửi thông báo xác nhận thanh toán đến Nhiếp ảnh gia!",
      data: order
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi khi xác nhận chuyển khoản: " + error.message });
  }
};
