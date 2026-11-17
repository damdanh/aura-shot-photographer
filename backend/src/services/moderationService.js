const vision = require('@google-cloud/vision');
const fs = require('fs');

let visionClient = null;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    visionClient = new vision.ImageAnnotatorClient();
    console.log("🟢 Google Cloud Vision Client: Khởi tạo thành công.");
  } else {
    console.warn("⚠️ CẢNH BÁO: GOOGLE_APPLICATION_CREDENTIALS chưa được cấu hình. Sử dụng Mock Moderation.");
  }
} catch (err) {
  console.error("Lỗi cấu hình Google Cloud Vision:", err.message);
}

// Danh sách từ cấm mẫu (Bad words)
const BAD_WORDS = [
  'dit', 'ditme', 'chui', 'fuck', 'bitch', 'asshole', 'sex', 'porn', 'khoatran', 'nude', 'damdang', 'lon', 'cac',
  'địt', 'đéo', 'đm', 'vcl', 'cặc', 'lồn', 'chịch', 'dkm', 'bú', 'đĩ', 'mẹ mày', 'shit', 'pussy', 'nudity', 'nsfw'
];

/**
 * 1. Kiểm duyệt văn bản (Bad Words Filter - HEAD)
 * Trả về true nếu vi phạm, false nếu an toàn
 */
exports.checkTextViolation = (text) => {
  if (!text) return false;
  const lowercaseText = text.toLowerCase();
  return BAD_WORDS.some(word => lowercaseText.includes(word));
};

/**
 * 2. Kiểm duyệt hình ảnh (Vision API - HEAD)
 */
exports.checkImageViolation = async (imageBuffer) => {
  if (!visionClient) {
    return false;
  }
  try {
    const [result] = await visionClient.safeSearchDetection({ image: { content: imageBuffer } });
    const detections = result.safeSearchAnnotation;

    if (!detections) {
      throw new Error("Không nhận được phản hồi SafeSearch từ Vision API");
    }

    const likelihoods = ['LIKELY', 'VERY_LIKELY'];
    const isAdult = likelihoods.includes(detections.adult);
    const isViolence = likelihoods.includes(detections.violence);
    const isRacy = likelihoods.includes(detections.racy);

    console.log(`[AI Moderation] Kết quả quét: Adult: ${detections.adult}, Violence: ${detections.violence}, Racy: ${detections.racy}`);

    if (isAdult || isViolence || isRacy) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Lỗi kiểm duyệt Google Cloud Vision API:", error.message);
    return false;
  }
};

/**
 * 3. Kiểm duyệt văn bản (Lộc's checkText)
 * @param {string} text 
 * @returns {object} { isViolated: boolean, matchedWord: string }
 */
exports.checkText = (text) => {
  if (!text) return { isViolated: false };
  const lowerText = text.toLowerCase();
  
  for (const badWord of BAD_WORDS) {
    const regex = new RegExp(`\\b${badWord}\\b|${badWord}`, 'i');
    if (regex.test(lowerText)) {
      return { isViolated: true, matchedWord: badWord };
    }
  }
  return { isViolated: false };
};

/**
 * 4. Kiểm duyệt hình ảnh (Lộc's checkImage)
 * @param {Buffer} imageBuffer 
 * @param {string} fileName
 * @returns {Promise<object>} { isViolated: boolean, reason: string }
 */
exports.checkImage = async (imageBuffer, fileName = '') => {
  try {
    if (visionClient && imageBuffer) {
      const [result] = await visionClient.safeSearchDetection({ image: { content: imageBuffer } });
      const detections = result.safeSearchAnnotation;
      
      if (!detections) {
        return { isViolated: false };
      }
      
      const { adult, violence, racy } = detections;
      const unsafeLevels = ['LIKELY', 'VERY_LIKELY'];
      
      if (unsafeLevels.includes(adult) || unsafeLevels.includes(violence) || unsafeLevels.includes(racy)) {
        return {
          isViolated: true,
          reason: `Ảnh bị phát hiện chứa nội dung nhạy cảm/bạo lực (Adult: ${adult}, Violence: ${violence}, Racy: ${racy})`
        };
      }
      return { isViolated: false };
    }
  } catch (err) {
    console.warn("⚠️ [AI Moderation] Lỗi khi chạy Vision API:", err.message);
  }

  // Chế độ Giả lập (Simulation Mode)
  const lowerFileName = fileName.toLowerCase();
  const testBannedKeywords = ['nsfw', 'sexy', 'nudity', 'violence', 'porn', 'banned'];
  
  for (const keyword of testBannedKeywords) {
    if (lowerFileName.includes(keyword)) {
      return {
        isViolated: true,
        reason: `[Simulated] Tên ảnh chứa từ khóa nhạy cảm "${keyword}" kích hoạt tự động khóa.`
      };
    }
  }

  return { isViolated: false };
};
