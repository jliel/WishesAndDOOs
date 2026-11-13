import io
import os
import uuid
from typing import Tuple
from PIL import Image, ImageOps


class StorageError(Exception):
    def __init__(self, message: str, code: str = "storage_error", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_IMAGE_DIMENSION = 1600
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
# Defend against decompression bombs (max 25 Megapixels)
Image.MAX_IMAGE_PIXELS = 25_000_000


def get_upload_dir(base_dir: str) -> str:
    upload_path = os.path.join(base_dir, "uploads", "wishes")
    os.makedirs(upload_path, exist_ok=True)
    return upload_path


def process_and_save_wish_image(
    file_bytes: bytes,
    original_filename: str,
    base_dir: str,
    workspace_id: str,
) -> Tuple[str, str]:
    """
    Validates, strips EXIF data for privacy compliance, normalizes orientation,
    resizes if excessive, converts to clean WebP/JPEG, and saves to private storage.

    Returns:
        (storage_key, filename)
    """
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise StorageError("Image file size exceeds 5MB limit.", code="file_too_large", status_code=413)

    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise StorageError("Only PNG, JPEG, and WebP images are supported.", code="unsupported_format", status_code=400)

    try:
        image = Image.open(io.BytesIO(file_bytes))
        image.verify()  # Verify integrity
        # Re-open for actual processing since verify() closes/invalidates the stream
        image = Image.open(io.BytesIO(file_bytes))
    except Exception as e:
        raise StorageError("Invalid or corrupted image file.", code="corrupted_image", status_code=400) from e

    # Strip EXIF and handle orientation
    try:
        image = ImageOps.exif_transpose(image)
    except Exception:
        pass

    # Convert RGBA / P modes to RGB if saving as JPEG / WebP
    if image.mode in ("RGBA", "LA", "P"):
        if ext in ("jpg", "jpeg"):
            background = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            background.paste(image, mask=image.split()[-1] if len(image.split()) > 3 else None)
            image = background
        else:
            image = image.convert("RGBA")
    else:
        image = image.convert("RGB")

    # Resize if exceeds max dimension while preserving aspect ratio
    if image.width > MAX_IMAGE_DIMENSION or image.height > MAX_IMAGE_DIMENSION:
        image.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS)

    # Generate secure, unguessable storage key
    filename = f"{workspace_id}_{uuid.uuid4().hex}.webp"
    upload_dir = get_upload_dir(base_dir)
    target_path = os.path.join(upload_dir, filename)

    # Save as high-quality WebP without metadata/EXIF
    image.save(target_path, "WEBP", quality=88, method=6)

    storage_key = f"wishes/{filename}"
    return storage_key, filename


def get_image_absolute_path(storage_key: str, base_dir: str) -> str:
    """Resolves a storage key to the absolute local filesystem path."""
    clean_key = storage_key.replace("wishes/", "")
    clean_name = os.path.basename(clean_key)
    path = os.path.join(get_upload_dir(base_dir), clean_name)
    if not os.path.exists(path):
        raise StorageError("Stored image not found.", code="not_found", status_code=404)
    return path
