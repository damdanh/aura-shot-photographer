// backend/src/services/ghnService.js
// Dịch vụ tích hợp API Giao Hàng Nhanh (GHN)
// Tài liệu: https://api.ghn.vn/home/docs/detail
const axios = require('axios');
const ADDRESS_API = 'https://provinces.open-api.vn/api';

// ─── Cấu hình ───────────────────────────────────────────────────────────────
const IS_SANDBOX = process.env.GHN_ENV !== 'production';

const BASE_URL = IS_SANDBOX
  ? 'https://dev-online-gateway.ghn.vn/shiip/public-api'
  : 'https://online-gateway.ghn.vn/shiip/public-api';

const GHN_TOKEN  = process.env.GHN_API_TOKEN  || '';
const GHN_SHOPID = process.env.GHN_SHOP_ID    || '';

// Địa chỉ kho/cửa hàng mặc định (cấu hình trong .env)
const FROM_DISTRICT_ID = parseInt(process.env.GHN_FROM_DISTRICT_ID || '0', 10);
const FROM_WARD_CODE   = process.env.GHN_FROM_WARD_CODE || '';

// ─── Axios instance dùng chung ───────────────────────────────────────────────
const ghnAxios = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Token': GHN_TOKEN,
    'ShopId': GHN_SHOPID
  }
});

// ─── Kiểm tra cấu hình GHN ───────────────────────────────────────────────────
const isConfigured = () => Boolean(GHN_TOKEN && GHN_SHOPID);

// ─── 1. Lấy danh sách Tỉnh/Thành phố ────────────────────────────────────────
const getProvinces = async () => {
  if (!isConfigured()) {
    const response = await axios.get(`${ADDRESS_API}/p/`, { timeout: 10000 });
    return response.data.map(province => ({ province_id: province.code, province_name: province.name, code: String(province.code) }));
  }

  const response = await ghnAxios.get('/master-data/province');

  if (!response.data || response.data.code !== 200) {
    throw new Error(`GHN API lỗi: ${response.data?.message || 'Không thể lấy danh sách tỉnh thành'}`);
  }

  return response.data.data.map(province => ({
    province_id: province.ProvinceID,
    province_name: province.ProvinceName,
    code: province.Code
  }));
};

// ─── 2. Lấy danh sách Quận/Huyện theo ProvinceID ────────────────────────────
const getDistricts = async (provinceId) => {
  if (!provinceId) throw new Error('Thiếu province_id');
  if (!isConfigured()) {
    const response = await axios.get(`${ADDRESS_API}/p/${provinceId}?depth=2`, { timeout: 10000 });
    return (response.data.districts || []).map(district => ({ district_id: district.code, district_name: district.name, province_id: Number(provinceId) }));
  }

  const response = await ghnAxios.get('/master-data/district', {
    params: { province_id: provinceId }
  });

  if (!response.data || response.data.code !== 200) {
    throw new Error(`GHN API lỗi: ${response.data?.message || 'Không thể lấy danh sách quận huyện'}`);
  }

  return response.data.data.map(district => ({
    district_id: district.DistrictID,
    district_name: district.DistrictName,
    province_id: district.ProvinceID
  }));
};

// ─── 3. Lấy danh sách Phường/Xã theo DistrictID ─────────────────────────────
const getWards = async (districtId) => {
  if (!districtId) throw new Error('Thiếu district_id');
  if (!isConfigured()) {
    const response = await axios.get(`${ADDRESS_API}/d/${districtId}?depth=2`, { timeout: 10000 });
    return (response.data.wards || []).map(ward => ({ ward_code: String(ward.code), ward_name: ward.name, district_id: Number(districtId) }));
  }

  const response = await ghnAxios.get('/master-data/ward', {
    params: { district_id: districtId }
  });

  if (!response.data || response.data.code !== 200) {
    throw new Error(`GHN API lỗi: ${response.data?.message || 'Không thể lấy danh sách phường xã'}`);
  }

  return response.data.data.map(ward => ({
    ward_code: ward.WardCode,
    ward_name: ward.WardName,
    district_id: ward.DistrictID
  }));
};

// ─── 4. Lấy danh sách dịch vụ khả dụng ─────────────────────────────────────
const getAvailableServices = async (fromDistrictId, toDistrictId) => {
  if (!isConfigured()) throw new Error('GHN chưa được cấu hình');

  const response = await ghnAxios.get('/v2/shipping-order/available-services', {
    params: {
      shop_id: parseInt(GHN_SHOPID, 10),
      from_district: fromDistrictId,
      to_district: toDistrictId
    }
  });

  if (!response.data || response.data.code !== 200) {
    throw new Error(`GHN API lỗi: ${response.data?.message || 'Không thể lấy danh sách dịch vụ'}`);
  }

  return response.data.data;
};

// ─── 5. Tính phí ship thực tế (hàm chính) ───────────────────────────────────
/**
 * Tính phí vận chuyển GHN thực tế
 * @param {Object} params
 * @param {number} params.toDistrictId   - Mã quận/huyện người nhận
 * @param {string} params.toWardCode     - Mã phường/xã người nhận
 * @param {number} [params.weight=500]   - Khối lượng (gram), mặc định 500g
 * @param {number} [params.insuranceValue=0] - Giá trị khai báo (VND)
 * @param {number} [params.serviceTypeId=2]  - 2=Hàng nhẹ, 5=Hàng nặng
 * @returns {{ total: number, leadtime: string, service_fee: number }}
 */
const calculateShippingFee = async ({
  toDistrictId,
  toWardCode,
  weight = 500,
  insuranceValue = 0,
  serviceTypeId = 2
}) => {
  if (!isConfigured()) {
    throw new Error('GHN_API_TOKEN và GHN_SHOP_ID chưa được cấu hình trong .env');
  }
  if (!toDistrictId || !toWardCode) {
    throw new Error('Thiếu thông tin địa chỉ người nhận (to_district_id, to_ward_code)');
  }
  if (!FROM_DISTRICT_ID || !FROM_WARD_CODE) {
    throw new Error('Chưa cấu hình địa chỉ cửa hàng (GHN_FROM_DISTRICT_ID, GHN_FROM_WARD_CODE) trong .env');
  }

  const payload = {
    service_type_id: serviceTypeId,
    from_district_id: FROM_DISTRICT_ID,
    from_ward_code: FROM_WARD_CODE,
    to_district_id: parseInt(toDistrictId, 10),
    to_ward_code: String(toWardCode),
    weight: parseInt(weight, 10),
    length: 20,    // cm — kích thước mặc định cho khung ảnh/album in
    width: 20,
    height: 5,
    insurance_value: parseInt(insuranceValue, 10) || 0
  };

  console.log(`[GHN Service] Tính phí ship ${IS_SANDBOX ? '(SANDBOX)' : '(PRODUCTION)'}:`, payload);

  const response = await ghnAxios.post('/v2/shipping-order/fee', payload);

  if (!response.data || response.data.code !== 200) {
    throw new Error(`GHN API lỗi: ${response.data?.message || 'Tính phí thất bại'}`);
  }

  const data = response.data.data;
  return {
    total: data.total,                           // Tổng phí ship (VND)
    service_fee: data.service_fee,               // Phí dịch vụ cơ bản
    insurance_fee: data.insurance_fee || 0,      // Phí bảo hiểm hàng hóa
    leadtime: data.leadtime                       // Thời gian giao hàng dự kiến (Unix timestamp)
      ? new Date(data.leadtime * 1000).toLocaleDateString('vi-VN')
      : '2-3 ngày làm việc'
  };
};

// ─── Hàm fallback khi GHN gặp lỗi ──────────────────────────────────────────
/**
 * Ước tính phí ship dự phòng khi GHN API không khả dụng
 * Dựa theo khoảng cách district_id (logic đơn giản)
 */
const getFallbackFee = (toDistrictId) => {
  // TP.HCM: 1440-1490, Hà Nội: 1490-1520 → Nội thành lớn
  const distId = parseInt(toDistrictId, 10) || 0;
  const isUrban = (distId >= 1440 && distId <= 1490) || (distId >= 1490 && distId <= 1530);
  return {
    total: isUrban ? 25000 : 45000,
    service_fee: isUrban ? 25000 : 45000,
    insurance_fee: 0,
    leadtime: isUrban ? '1-2 ngày' : '3-5 ngày',
    is_fallback: true // Đánh dấu đây là ước tính dự phòng
  };
};

module.exports = {
  isConfigured,
  getProvinces,
  getDistricts,
  getWards,
  getAvailableServices,
  calculateShippingFee,
  getFallbackFee
};
