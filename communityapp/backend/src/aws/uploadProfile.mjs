import { SECRET_ACCESS_KEY, REGION, ACCESS_KEY } from "../../config.mjs";
import aws from "aws-sdk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

aws.config.update({
    secretAccessKey: SECRET_ACCESS_KEY,
    accessKeyId: ACCESS_KEY,
    region: REGION
});
const s3 = new aws.S3({apiVersion: "2006-03-01"});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../uploads");

const safeFileName = (name = "upload") => {
    const ext = path.extname(name);
    const base = path.basename(name, ext).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "upload";
    return `${Date.now()}-${base}${ext}`;
};

const uploadLocally = async (file, publicBaseUrl = "") => {
    const fileName = safeFileName(file.originalname);
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, fileName), file.buffer);
    return `${publicBaseUrl.replace(/\/$/, "")}/uploads/${fileName}`;
};

const uploadFile = async (file, options = {}) => {
    const publicBaseUrl = options.publicBaseUrl || "";

    if (!file || !file.buffer) {
        throw new Error("Invalid file object: buffer is missing");
    }
    if (!file.originalname) {
        throw new Error("Invalid file object: originalname is missing");
    }

    if (!ACCESS_KEY || !SECRET_ACCESS_KEY || !REGION) {
        return uploadLocally(file, publicBaseUrl);
    }

    return new Promise((resolve, reject) => {
        const key = `fsdclass/${safeFileName(file.originalname)}`;
        const uploadParams = {
            ACL: "public-read",
            Bucket: "fsdclass",
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype || "application/octet-stream",
        }
        s3.upload(uploadParams, (err, data) => {
            if(err) {
                console.error("S3 Upload Error Details:", {
                    code: err.code,
                    message: err.message,
                    statusCode: err.statusCode,
                    region: REGION,
                    bucket: uploadParams.Bucket,
                    key: uploadParams.Key
                });
                uploadLocally(file, publicBaseUrl).then(resolve).catch(reject);
                return;
            }
            if(!data || !data.Location) {
                uploadLocally(file, publicBaseUrl).then(resolve).catch(reject);
                return;
            }
            resolve(data.Location); // s3 url
        })
    })
}
export default uploadFile;
