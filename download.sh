#!/bin/bash
mkdir -p public/models

echo "Baixando modelos do face-api.js..."
curl -o public/models/tiny_face_detector_model-weights_manifest.json \
  https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js/weights/tiny_face_detector_model-weights_manifest.json
curl -o public/models/tiny_face_detector_model-shard1 \
  https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js/weights/tiny_face_detector_model-shard1

curl -o public/models/face_landmark_68_model-weights_manifest.json \
  https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js/weights/face_landmark_68_model-weights_manifest.json
curl -o public/models/face_landmark_68_model-shard1 \
  https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js/weights/face_landmark_68_model-shard1

curl -o public/models/age_gender_model-weights_manifest.json \
  https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js/weights/age_gender_model-weights_manifest.json
curl -o public/models/age_gender_model-shard1 \
  https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js/weights/age_gender_model-shard1

curl -o public/models/face_expression_model-weights_manifest.json \
  https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js/weights/face_expression_model-weights_manifest.json
curl -o public/models/face_expression_model-shard1 \
  https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js/weights/face_expression_model-shard1

echo "Modelos baixados com sucesso ✅"