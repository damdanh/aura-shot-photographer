/**
 * Simple in-memory cache middleware cho các public GET endpoints.
 * Dữ liệu được cache trong RAM server, giúp loại bỏ hoàn toàn 
 * việc query MongoDB cho những request lặp lại trong vòng TTL.
 */

const cache = new Map(); // key -> { data, expiresAt }

/**
 * @param {number} ttlSeconds - Thời gian cache tồn tại (giây)
 */
function cacheMiddleware(ttlSeconds = 300) {
  return (req, res, next) => {
    // Chỉ cache GET request
    if (req.method !== 'GET') return next();

    const key = `${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached && Date.now() < cached.expiresAt) {
      return res.json(cached.data);
    }

    // Monkey-patch res.json để lưu response vào cache
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200) {
        cache.set(key, {
          data,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Xóa cache khi dữ liệu thay đổi (gọi sau khi create/update/delete)
 * @param {string} prefix - Tiền tố URL cần xóa (vd: '/api/products')
 */
function invalidateCache(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

module.exports = { cacheMiddleware, invalidateCache };
