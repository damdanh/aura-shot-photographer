// backend/src/services/faceService.js
const tf = require('@tensorflow/tfjs');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const { Jimp } = require('jimp');
const path = require('path');

let isModelLoaded = false;

async function initFaceAPI() {
    if (isModelLoaded) return;
    await tf.ready();
    await tf.setBackend('wasm');
    const modelPath = path.join(__dirname, '../config/face-api-models');
    
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath); 
    
    isModelLoaded = true;
    console.log('[AI Service] Đã tải thành công mô hình!');
}

async function imageBufferTo3DTensor(imageBuffer) {
    const image = await Jimp.read(imageBuffer);
    let width = image.bitmap.width;
    let height = image.bitmap.height;

    const MAX_SIZE = 800; 
    if (width > MAX_SIZE || height > MAX_SIZE) {
        // Tính toán tỷ lệ ảnh (Aspect Ratio) thủ công để tránh truyền giá trị undefined cho Jimp mới
        const aspectRatio = width / height;
        let newWidth = width;
        let newHeight = height;

        if (width > height) {
            newWidth = MAX_SIZE;
            newHeight = Math.round(MAX_SIZE / aspectRatio);
        } else {
            newHeight = MAX_SIZE;
            newWidth = Math.round(MAX_SIZE * aspectRatio);
        }

        console.log(`[AI Service] Resize ảnh từ ${width}x${height} về ${newWidth}x${newHeight}`);
        
        image.resize({ w: newWidth, h: newHeight });
        
        // Cập nhật lại thông số width/height thực tế sau khi đã resize
        width = image.bitmap.width;
        height = image.bitmap.height;
    }

    const buffer = image.bitmap.data;
    const numpixels = width * height;
    const rgbValues = new Int32Array(numpixels * 3);

    for (let i = 0; i < numpixels; i++) {
        rgbValues[i * 3] = buffer[i * 4];    
        rgbValues[i * 3 + 1] = buffer[i * 4 + 1]; 
        rgbValues[i * 3 + 2] = buffer[i * 4 + 2]; 
    }

    // Trả về tensor dạng int32 phù hợp với cấu hình Face-API
    return tf.tensor3d(rgbValues, [height, width, 3], 'int32');
} 

async function detectFaces(imageBuffer) { 
    await initFaceAPI();
    const tensor = await imageBufferTo3DTensor(imageBuffer);
    try {
        const detections = await faceapi.detectAllFaces(tensor)
            .withFaceLandmarks()
            .withFaceDescriptors();
        
        return detections.map(det => ({
            box: {
                x: det.detection.box.x,
                y: det.detection.box.y, 
                width: det.detection.box.width,
                height: det.detection.box.height 
            },
            descriptor: Array.from(det.descriptor) 
        }));
    } finally {
        tensor.dispose(); // Giải phóng bộ nhớ Tensor tránh rò rỉ và tràn RAM
    }
}

function getDistance(descriptor1, descriptor2) {
    return faceapi.euclideanDistance(new Float32Array(descriptor1), new Float32Array(descriptor2));
}

module.exports = { initFaceAPI, detectFaces, getDistance };