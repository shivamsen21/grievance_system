const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

/**
 * Uploads a base64 or buffer image to Cloudinary
 * @param {string} fileData  - base64 data URI or file path
 * @param {string} folder    - Cloudinary folder name (default: 'grievances')
 * @returns {Promise<{url: string, public_id: string, width: number, height: number}>}
 */
async function uploadImage(fileData, folder = 'grievances') {
  const result = await cloudinary.uploader.upload(fileData, {
    folder,
    resource_type: 'image',
    transformation: [
      { quality: 'auto:good' },  // auto-optimise quality
      { fetch_format: 'auto' },  // serve as WebP/AVIF when supported
    ],
  });

  return {
    url:       result.secure_url,
    public_id: result.public_id,
    width:     result.width,
    height:    result.height,
  };
}

/**
 * Deletes an image from Cloudinary by its public_id
 * @param {string} publicId
 */
async function deleteImage(publicId) {
  if (!publicId) return;
  return cloudinary.uploader.destroy(publicId);
}

module.exports = { uploadImage, deleteImage };
