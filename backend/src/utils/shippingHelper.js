// backend/src/utils/shippingHelper.js
const REGIONS = {
  north: [
    "Hà Nội", "Hải Phòng", "Quảng Ninh", "Bắc Ninh", "Thái Bình", "Nam Định", 
    "Ninh Bình", "Hà Nam", "Vĩnh Phúc", "Phú Thọ", "Lạng Sơn", "Sơn La", 
    "Cao Bằng", "Hà Giang", "Tuyên Quang", "Bắc Kạn", "Thái Nguyên", "Yên Bái", 
    "Điện Biên", "Lai Châu", "Hòa Bình", "Hải Dương", "Hưng Yên", "Bắc Giang"
  ],
  central: [
    "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình", "Quảng Trị", "Thừa Thiên Huế", 
    "Đà Nẵng", "Quảng Nam", "Quảng Ngãi", "Bình Định", "Phú Yên", "Khánh Hòa", 
    "Ninh Thuận", "Bình Thuận", "Kon Tum", "Gia Lai", "Đắk Lắk", "Đắk Nông", "Lâm Đồng"
  ],
  south: [
    "Hồ Chí Minh", "Bình Dương", "Đồng Nai", "Bà Rịa - Vũng Tàu", "Tây Ninh", 
    "Bình Phước", "Long An", "Tiền Giang", "Bến Tre", "Trà Vinh", "Vĩnh Long", 
    "Đồng Tháp", "An Giang", "Kiên Giang", "Cần Thơ", "Hậu Giang", "Sóc Trăng", 
    "Bạc Liêu", "Cà Mau"
  ]
};

// Hàm chuẩn hóa tiếng Việt không dấu
function removeVietnameseTones(str) {
  if (!str) return "";
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ã/g, "i");
  str = str.replace(/ò|á|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Á|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ư|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  
  str = str.replace(/\u0300|\u0301|\u0309|\u0303|\u0323/g, "");
  str = str.replace(/\u02C6|\u0306|\u031B/g, "");
  return str.trim();
}

// Tìm Tỉnh/Thành phố
function detectProvince(address) {
  if (!address) return null;
  const normalizeAddress = removeVietnameseTones(address).toLowerCase();
  
  for (const region in REGIONS) {
    for (const province of REGIONS[region]) {
      const normalizeProvince = removeVietnameseTones(province).toLowerCase();
      
      if (normalizeProvince === "ho chi minh" && (normalizeAddress.includes("hcm") || normalizeAddress.includes("sai gon"))) {
        return { name: "Hồ Chí Minh", region };
      }
      if (normalizeProvince === "ha noi" && normalizeAddress.includes("hn")) {
        return { name: "Hà Nội", region };
      }

      if (normalizeAddress.includes(normalizeProvince)) {
        return { name: province, region };
      }
    }
  }
  return null;
}

exports.calculateShippingFee = (storeAddress = "Hà Nội", customerAddress) => {
  if (!customerAddress) {
    return { fee: 30000, regionType: "unknown", estimatedDelivery: "2-3 ngày" };
  }
  const store = detectProvince(storeAddress) || { region: "north", name: "Hà Nội" };
  const customer = detectProvince(customerAddress); 
  
  if (!customer) {
    return { fee: 30000, regionType: "default", estimatedDelivery: "2-3 ngày" };
  }
  
  // Nội tỉnh
  if (store.name.toLowerCase() === customer.name.toLowerCase()){
    return { fee: 15000, regionType: "Nội tỉnh (Cùng Tỉnh/Thành)", estimatedDelivery: "1-2 ngày" };
  }
  
  // Nội vùng (Cùng miền)
  if (store.region === customer.region) {
    return {
      fee: 28000, // Thống nhất giá trị phí ship nội vùng
      regionType: `Nội vùng (${store.region === 'north' ? 'Miền Bắc' : store.region === 'central' ? 'Miền Trung' : 'Miền Nam'})`,
      estimatedDelivery: "2-3 ngày"
    };
  }
  
  // Liên vùng
  return {
    fee: 45000,
    regionType: "Liên vùng (Khác miền)", 
    estimatedDelivery: "3-5 ngày" 
  };
};
