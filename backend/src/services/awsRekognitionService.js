// backend/src/services/awsRekognitionService.js
const { 
    RekognitionClient, 
    CreateCollectionCommand, 
    DeleteCollectionCommand, 
    IndexFacesCommand, 
    SearchFacesByImageCommand 
} = require("@aws-sdk/client-rekognition");

const awsRegion = process.env.AWS_REGION || "us-east-1";
const isAwsConfigured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

let rekognitionClient = null;
if (isAwsConfigured) {
    rekognitionClient = new RekognitionClient({
        region: awsRegion,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    });
    console.log("🟢 AWS Rekognition: Service initialized successfully.");
} else {
    console.warn("⚠️ AWS Rekognition: Credentials missing. Running in Mock Mode.");
}

// Helpers for encoding URLs to meet AWS ExternalImageId requirements (Alphanumeric, underscores, hyphens, colons, periods)
function encodeUrlToExternalImageId(url) {
    return Buffer.from(url).toString("hex");
}

function decodeExternalImageIdToUrl(externalImageId) {
    try {
        return Buffer.from(externalImageId, "hex").toString("utf-8");
    } catch (err) {
        console.error("❌ Failed to decode ExternalImageId:", externalImageId, err);
        return externalImageId;
    }
}

/**
 * 1. Tạo một Face Collection cho Album trên Rekognition (Phiên bản S3)
 * @param {string} collectionId 
 */
async function createAlbumCollection(collectionId) {
    try {
        if (!isAwsConfigured) {
            console.log(`[MOCK AWS] Collection created or already exists: ${collectionId}`);
            return { success: true };
        }
        const command = new CreateCollectionCommand({
            CollectionId: collectionId
        });
        const response = await rekognitionClient.send(command);
        console.log(`[AWS Rekognition] Đã tạo collection: ${collectionId}`);
        return response;
    } catch (error) {
        if (error.name === 'ResourceAlreadyExistsException') {
            console.log(`[AWS Rekognition] Collection đã tồn tại: ${collectionId}`);
            return { success: true };
        }
        throw error;
    }
}

/**
 * 2. Xóa Face Collection của Album trên Rekognition (Phiên bản S3)
 * @param {string} collectionId 
 */
async function deleteAlbumCollection(collectionId) {
    try {
        if (!isAwsConfigured) {
            console.log(`[MOCK AWS] Collection deleted: ${collectionId}`);
            return { success: true };
        }
        const command = new DeleteCollectionCommand({
            CollectionId: collectionId
        });
        const response = await rekognitionClient.send(command);
        console.log(`[AWS Rekognition] Đã xóa collection: ${collectionId}`);
        return response;
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            console.log(`[AWS Rekognition] Không tìm thấy collection để xóa: ${collectionId}`);
            return { success: true };
        }
        throw error;
    }
}

/**
 * 3. Trích xuất khuôn mặt từ ảnh trên S3 và lưu vào Collection
 * @param {string} collectionId 
 * @param {string} s3Key 
 * @returns {Promise<Array>} Danh sách các khuôn mặt đã lưu (bao gồm FaceId và tọa độ khung mặt)
 */
async function indexFacesInPhoto(collectionId, s3Key) {
    if (!isAwsConfigured) {
        const mockFaceId = 'mock_face_' + Math.random().toString(36).substring(2, 15);
        console.log(`[MOCK AWS] Face indexed into collection ${collectionId}. Mock Face ID: ${mockFaceId}`);
        return [{
            faceId: mockFaceId,
            box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }
        }];
    }
    // Ký tự "/" trong S3 key không hợp lệ đối với ExternalImageId của AWS Rekognition.
    // Chúng ta thay thế "/" thành dấu ":" (kí tự hợp lệ trên Rekognition).
    const externalImageId = s3Key.replace(/\//g, ':');

    const command = new IndexFacesCommand({
        CollectionId: collectionId,
        Image: {
            S3Object: {
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Name: s3Key
            }
        },
        ExternalImageId: externalImageId,
        MaxFaces: 15,
        QualityFilter: "AUTO"
    });

    const response = await rekognitionClient.send(command);
    return response.FaceRecords.map(record => ({
        faceId: record.Face.FaceId,
        box: {
            x: record.FaceDetail.BoundingBox.Left,
            y: record.FaceDetail.BoundingBox.Top,
            width: record.FaceDetail.BoundingBox.Width,
            height: record.FaceDetail.BoundingBox.Height
        }
    }));
}

/**
 * 4. Tìm kiếm các khuôn mặt khớp với ảnh Selfie trong Collection (Phiên bản S3)
 * @param {string} collectionId 
 * @param {Buffer} selfieBuffer 
 * @param {number} threshold - Độ tương đồng tối thiểu (mặc định 80%)
 * @returns {Promise<Array>} Danh sách các ảnh có khuôn mặt khớp (bao gồm S3 Key và độ tương đồng)
 */
async function searchFacesBySelfie(collectionId, selfieBuffer, threshold = 80) {
    if (!isAwsConfigured) {
        console.log(`[MOCK AWS] Searching faces in collection ${collectionId} (Mock mode matches)`);
        return [
            { faceId: 'mock_face_1', s3Key: 'mock_s3_key_1.jpg', similarity: 95 },
            { faceId: 'mock_face_2', s3Key: 'mock_s3_key_2.jpg', similarity: 88 }
        ];
    }
    const command = new SearchFacesByImageCommand({
        CollectionId: collectionId,
        Image: {
            Bytes: selfieBuffer
        },
        FaceMatchThreshold: threshold,
        MaxFaces: 100
    });

    const response = await rekognitionClient.send(command);
    
    const matchedFaces = [];
    if (response.FaceMatches) {
        for (const match of response.FaceMatches) {
            if (match.Face && match.Face.ExternalImageId) {
                // Khôi phục S3 Key bằng cách đổi ngược dấu ":" lại thành "/"
                const s3Key = match.Face.ExternalImageId.replace(/:/g, '/');
                matchedFaces.push({
                    faceId: match.Face.FaceId,
                    s3Key: s3Key,
                    similarity: match.Similarity
                });
            }
        }
    }
    return matchedFaces;
}

/**
 * 5. Creates a face collection (Lộc's compatibility)
 * @param {string} collectionId 
 */
async function createFaceCollection(collectionId) {
    return createAlbumCollection(collectionId);
}

/**
 * 6. Indexes a face image to the collection (Lộc's compatibility)
 * @param {string} collectionId 
 * @param {Buffer} imageBuffer 
 * @param {string} driveImageUrl 
 */
async function indexFaceToCollection(collectionId, imageBuffer, driveImageUrl) {
    try {
        const externalImageId = encodeUrlToExternalImageId(driveImageUrl);

        if (!isAwsConfigured) {
            console.log(`[MOCK AWS] Face indexed into collection ${collectionId}. ExternalImageId: ${externalImageId}`);
            return { success: true, FaceRecords: [{ Face: { ExternalImageId: externalImageId } }] };
        }

        const command = new IndexFacesCommand({
            CollectionId: collectionId,
            Image: { Bytes: imageBuffer },
            ExternalImageId: externalImageId,
            MaxFaces: 1,
            DetectionAttributes: ["DEFAULT"]
        });

        const response = await rekognitionClient.send(command);
        console.log(`[AWS] Indexed face successfully to collection ${collectionId}. ExternalImageId encoded from: ${driveImageUrl}`);
        return response;
    } catch (error) {
        console.error("❌ Error indexing face to collection:", error);
        throw error;
    }
}

/**
 * 7. Searches face collection for matches (Lộc's compatibility)
 * @param {string} collectionId 
 * @param {Buffer} selfieBuffer 
 * @returns {Promise<string[]>} Array of decoded Drive URLs
 */
async function searchFacesByImage(collectionId, selfieBuffer) {
    try {
        if (!isAwsConfigured) {
            console.log(`[MOCK AWS] Searching faces in collection ${collectionId} (Mocking matched images)`);
            return [
                "https://drive.google.com/uc?id=mock_file_1",
                "https://drive.google.com/uc?id=mock_file_2",
                "https://drive.google.com/uc?id=mock_file_3"
            ];
        }

        const command = new SearchFacesByImageCommand({
            CollectionId: collectionId,
            Image: { Bytes: selfieBuffer },
            FaceMatchThreshold: 80,
            MaxFaces: 100
        });

        const response = await rekognitionClient.send(command);
        const matchedUrls = [];
        if (response.FaceMatches && response.FaceMatches.length > 0) {
            for (const match of response.FaceMatches) {
                if (match.Face && match.Face.ExternalImageId) {
                    const decodedUrl = decodeExternalImageIdToUrl(match.Face.ExternalImageId);
                    matchedUrls.push(decodedUrl);
                }
            }
        }

        console.log(`[AWS] Face search returned ${matchedUrls.length} matches in collection ${collectionId}`);
        return matchedUrls;
    } catch (error) {
        console.error("❌ Error searching faces by image:", error);
        throw error;
    }
}

module.exports = {
    createAlbumCollection,
    deleteAlbumCollection,
    indexFacesInPhoto,
    searchFacesBySelfie,
    createFaceCollection,
    indexFaceToCollection,
    searchFacesByImage,
    rekognitionClient
};
