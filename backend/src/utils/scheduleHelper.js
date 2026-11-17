const PhotographerProfile = require('../models/PhotographerProfile');
const Order = require('../models/Order');

/**
 * Parse booking date string into structured date and time range
 * Examples:
 * - "2026-08-23T06:00-09:00" -> { date: "2026-08-23", startTime: "06:00", endTime: "09:00", isFullDay: false }
 * - "2026-08-23T06:00:00"   -> { date: "2026-08-23", startTime: "06:00", endTime: "08:00", isFullDay: false }
 * - "2026-08-23"            -> { date: "2026-08-23", startTime: "00:00", endTime: "23:59", isFullDay: true }
 */
function parseBookingSlot(bookingDateStr) {
  if (!bookingDateStr) return null;
  const raw = String(bookingDateStr).trim();
  if (raw.includes("T")) {
    const parts = raw.split("T");
    const date = parts[0];
    const timePart = parts[1] || "";
    const rangeMatch = timePart.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})/);
    if (rangeMatch) {
      let start = rangeMatch[1];
      let end = rangeMatch[2];
      const startH = parseInt(start.slice(0, 2), 10);
      let endH = parseInt(end.slice(0, 2), 10);
      const endM = end.slice(3, 5);
      if (endH <= startH) {
        if (endH + 12 > startH && endH + 12 <= 24) {
          endH += 12;
        } else {
          endH = Math.min(23, startH + 2);
        }
        end = `${String(Math.min(23, endH)).padStart(2, '0')}:${endM}`;
      }
      return { date, startTime: start, endTime: end, isFullDay: false };
    }
    const singleMatch = timePart.match(/^(\d{2}:\d{2})/);
    if (singleMatch) {
      const startH = parseInt(singleMatch[1].slice(0, 2), 10);
      const endH = Math.min(23, startH + 2);
      const endTime = `${String(endH).padStart(2, '0')}:${singleMatch[1].slice(3, 5)}`;
      return { date, startTime: singleMatch[1], endTime, isFullDay: false };
    }
    return { date, startTime: "00:00", endTime: "23:59", isFullDay: true };
  }
  return { date: raw.slice(0, 10), startTime: "00:00", endTime: "23:59", isFullDay: true };
}

/**
 * Check if two time slots overlap on the same day
 */
function isOverlapping(slotA, slotB) {
  if (!slotA || !slotB) return false;
  if (slotA.date !== slotB.date) return false;
  if (slotA.isFullDay || slotB.isFullDay) return true;

  const toMinutes = (timeStr, fallback) => {
    if (!timeStr) return fallback;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const startA = toMinutes(slotA.startTime, 0);
  const endA = toMinutes(slotA.endTime, 24 * 60);
  const startB = toMinutes(slotB.startTime, 0);
  const endB = toMinutes(slotB.endTime, 24 * 60);

  return startA < endB && endA > startB;
}

/**
 * Check if a requested booking date/time conflicts with photographer's busy schedule or confirmed orders
 */
async function checkPhotographerConflict(photographerId, bookingDateStr, options = {}) {
  const { excludeOrderId, userId } = options;
  const requestedSlot = parseBookingSlot(bookingDateStr);
  if (!requestedSlot) return { conflict: false };

  // 1. Kiểm tra lịch bận do Thợ ảnh tự cài đặt
  const profile = await PhotographerProfile.findOne({ user_id: photographerId });
  if (profile) {
    // 1.1 Thợ đánh dấu bận nguyên ngày
    if (Array.isArray(profile.busy_dates) && profile.busy_dates.includes(requestedSlot.date)) {
      return {
        conflict: true,
        reason: `Ngày ${requestedSlot.date} thợ chụp ảnh bận cả ngày! Vui lòng chọn ngày khác.`
      };
    }
    // 1.2 Thợ cài đặt khung giờ bận cá nhân
    if (Array.isArray(profile.busy_slots)) {
      for (const busy of profile.busy_slots) {
        if (busy.date === requestedSlot.date) {
          const busySlot = {
            date: busy.date,
            startTime: busy.start_time,
            endTime: busy.end_time,
            isFullDay: false
          };
          if (isOverlapping(requestedSlot, busySlot)) {
            return {
              conflict: true,
              reason: `Thợ chụp ảnh bận từ ${busy.start_time} đến ${busy.end_time} vào ngày ${requestedSlot.date} (${busy.note || 'Lịch bận'}). Vui lòng chọn giờ khác!`
            };
          }
        }
      }
    }
  }

  // 2. Kiểm tra các đơn hàng đã đặt / đã duyệt của thợ ảnh
  const orderQuery = {
    photographer_id: photographerId,
    status: { $in: ['Paid', 'Deposit Paid', 'Processing', 'Delivered', 'Completed', 'Confirmed'] },
    booking_date: { $ne: null }
  };
  if (excludeOrderId) {
    orderQuery._id = { $ne: excludeOrderId };
  }

  const existingOrders = await Order.find(orderQuery).select('booking_date orderCode');
  for (const ord of existingOrders) {
    const existingSlot = parseBookingSlot(ord.booking_date);
    if (existingSlot && isOverlapping(requestedSlot, existingSlot)) {
      const timeDesc = existingSlot.isFullDay
        ? `cả ngày ${existingSlot.date}`
        : `${existingSlot.startTime} - ${existingSlot.endTime} ngày ${existingSlot.date}`;
      return {
        conflict: true,
        reason: `Thợ chụp ảnh đã có lịch đặt vào ${timeDesc}. Vui lòng chọn khung giờ khác!`
      };
    }
  }

  // 3. Kiểm tra nếu chính user này đang có đơn Pending trùng khung giờ
  if (userId) {
    const myPendingOrders = await Order.find({
      user_id: userId,
      photographer_id: photographerId,
      status: 'Pending',
      booking_date: { $ne: null }
    }).select('booking_date orderCode');

    for (const pOrd of myPendingOrders) {
      if (excludeOrderId && String(pOrd._id) === String(excludeOrderId)) continue;
      const pSlot = parseBookingSlot(pOrd.booking_date);
      if (pSlot && isOverlapping(requestedSlot, pSlot)) {
        return {
          conflict: true,
          reason: `Bạn đang có đơn hàng #${pOrd.orderCode} chờ thanh toán cho khung giờ này. Vui lòng thanh toán hoặc hủy đơn cũ trước khi đặt mới!`
        };
      }
    }
  }

  return { conflict: false };
}

module.exports = {
  parseBookingSlot,
  isOverlapping,
  checkPhotographerConflict
};
