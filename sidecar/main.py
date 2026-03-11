# Import OpenCV library.
# OpenCV is used for image processing operations.
import cv2

# Import NumPy library.
# NumPy is used for numerical operations and working with image arrays.
import numpy as np

# Import base64 module.
# Frames from the browser are sent as base64 encoded strings.
# This module converts them back into image bytes.
import base64

# Import FastAPI framework.
# FastAPI is a modern Python framework used to build APIs.
from fastapi import FastAPI

# Import Pydantic BaseModel.
# BaseModel is used to define the structure of incoming JSON requests.
from pydantic import BaseModel

# Import typing helper.
# List tells Python that a variable is expected to be a list.
from typing import List

# Import MediaPipe Python API.
# MediaPipe is a Google library used for face/hand/body tracking.
from mediapipe.tasks import python as mp_python

# Import MediaPipe vision module.
# This module contains models for vision tasks like face detection.
from mediapipe.tasks.python import vision

# Import MediaPipe main package.
import mediapipe as mp


# ------------------------------------------------
# CREATE FASTAPI APPLICATION
# ------------------------------------------------

# Create FastAPI application instance.
# This will run the API server.
app = FastAPI()


# ------------------------------------------------
# FACE LANDMARK INDEXES
# ------------------------------------------------

# These indexes correspond to points on the face mesh.

# LEFT_EYE contains landmark indices representing the left eye.
LEFT_EYE = [362, 385, 387, 263, 373, 380]

# RIGHT_EYE contains landmark indices representing the right eye.
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

# NOSE_TIP is the landmark index representing the tip of the nose.
NOSE_TIP = 1


# ------------------------------------------------
# REQUEST STRUCTURE
# ------------------------------------------------


# Define structure of incoming API request.
# Pydantic automatically validates JSON data.
class AnalyzeRequest(BaseModel):
    # frames is a list of base64 images.
    frames: List[str]

    # direction indicates which direction the user must turn their head.
    direction: str


# ------------------------------------------------
# EYE ASPECT RATIO FUNCTION
# ------------------------------------------------


# This function calculates Eye Aspect Ratio (EAR).
# EAR measures whether eyes are open or closed.
def get_ear(landmarks, eye_indices, w, h):

    # Convert normalized landmark coordinates to pixel coordinates.
    pts = [(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in eye_indices]

    # Vertical distance between eyelid points
    v1 = abs(pts[1][1] - pts[5][1])

    # Another vertical distance between eyelids
    v2 = abs(pts[2][1] - pts[4][1])

    # Horizontal distance of the eye
    hor = abs(pts[0][0] - pts[3][0])

    # Prevent division by zero.
    if hor == 0:
        return 0.3

    # Return Eye Aspect Ratio.
    return (v1 + v2) / (2.0 * hor)


# ------------------------------------------------
# FRAME DECODING FUNCTION
# ------------------------------------------------


# Converts base64 image string into an OpenCV image.
def decode_frame(b64: str):

    # Sometimes base64 images include metadata like "data:image/jpeg;base64,"
    if "," in b64:
        b64 = b64.split(",")[1]

    # Decode base64 string into raw bytes.
    img_bytes = base64.b64decode(b64)

    # Convert bytes into NumPy array.
    arr = np.frombuffer(img_bytes, np.uint8)

    # Decode image using OpenCV.
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


# ------------------------------------------------
# LOAD MEDIAPIPE MODEL
# ------------------------------------------------

# Path to MediaPipe model file.
MODEL_PATH = "face_landmarker.task"


# Create base options for MediaPipe model.
base_options = mp_python.BaseOptions(model_asset_path=MODEL_PATH)


# Configure face landmarker options.
face_mesh_options = vision.FaceLandmarkerOptions(
    # Set base options
    base_options=base_options,
    # We don't need facial expressions (blendshapes)
    output_face_blendshapes=False,
    # Detect only 1 face
    num_faces=1,
    # Minimum confidence required to detect face
    min_face_detection_confidence=0.5,
)


# Create face landmark detector.
detector = vision.FaceLandmarker.create_from_options(face_mesh_options)


# ------------------------------------------------
# MAIN ANALYSIS ENDPOINT
# ------------------------------------------------


# API endpoint called by backend.
@app.post("/analyze")
async def analyze(req: AnalyzeRequest):

    # Threshold values used in detection.

    # EAR threshold below which eye is considered closed.
    EAR_THRESHOLD = 0.22

    # Nose movement threshold used to detect head turn.
    TURN_THRESHOLD = 0.04

    # Minimum number of blinks required.
    REQUIRED_BLINKS = 1

    # Blink counter
    blink_count = 0

    # Track if eyes were previously closed
    eyes_were_closed = False

    # Track if head turn was detected
    turn_detected = False

    # Baseline nose position
    base_nose_x = None

    # Loop through all frames sent by frontend.
    for b64 in req.frames:
        # Decode base64 image
        frame = decode_frame(b64)

        # If decoding failed skip frame
        if frame is None:
            continue

        # Get frame height and width
        h, w = frame.shape[:2]

        # Convert BGR (OpenCV format) to RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Convert image into MediaPipe format
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        # Run face landmark detection
        results = detector.detect(mp_image)

        # If no face detected skip frame
        if not results.face_landmarks:
            continue

        # Get first detected face
        landmarks = results.face_landmarks[0]

        # ------------------------------------------------
        # BLINK DETECTION
        # ------------------------------------------------

        # Compute EAR for left eye
        left_ear = get_ear(landmarks, LEFT_EYE, w, h)

        # Compute EAR for right eye
        right_ear = get_ear(landmarks, RIGHT_EYE, w, h)

        # Average EAR
        avg_ear = (left_ear + right_ear) / 2.0

        # If eyes are closed
        if avg_ear < EAR_THRESHOLD:
            eyes_were_closed = True

        # If eyes reopen after being closed
        elif eyes_were_closed:
            eyes_were_closed = False

            blink_count += 1

        # ------------------------------------------------
        # HEAD TURN DETECTION
        # ------------------------------------------------

        # Get x coordinate of nose tip
        nose_x = landmarks[NOSE_TIP].x

        # If baseline not set store first nose position
        if base_nose_x is None:
            base_nose_x = nose_x

        else:
            # Calculate nose movement
            delta = nose_x - base_nose_x

            # Check if user turned head left
            if req.direction == "left" and delta < -TURN_THRESHOLD:
                turn_detected = True

            # Check if user turned head right
            if req.direction == "right" and delta > TURN_THRESHOLD:
                turn_detected = True

        # If blink AND head turn detected stop early
        if blink_count >= REQUIRED_BLINKS and turn_detected:
            break

    # ------------------------------------------------
    # FINAL RESULT
    # ------------------------------------------------

    # If user never blinked
    if blink_count < REQUIRED_BLINKS:
        return {"passed": False, "reason": "No blink detected"}

    # If head turn not detected
    if not turn_detected:
        return {"passed": False, "reason": f"No head turn {req.direction} detected"}

    # If both checks passed
    return {"passed": True}

