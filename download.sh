#!/bin/bash
set -e

echo "🧹 Limpando pasta antiga..."
rm -rf public/models
mkdir -p public/models

# Base URL adaptada (verificar se existe)
BASE="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model"

echo "⬇️ Baixando modelos (novos formatos) …"

declare -a FILES=(
  "tiny_face_detector_model-weights_manifest.json"
  "tiny_face_detector_model.bin"

  "face_landmark_68_model-weights_manifest.json"
  "face_landmark_68_model.bin"

  "age_gender_model-weights_manifest.json"
  "age_gender_model.bin"

  "face_recognition_model-weights_manifest.json"
  "face_recognition_model.bin"

  "face_expression_model-weights_manifest.json"
  "face_expression_model.bin"

  "ssd_mobilenetv1_model-weights_manifest.json"
  "ssd_mobilenetv1_model.bin"
)

for FILE in "${FILES[@]}"; do
  echo "📥 Baixando $FILE ..."
  curl -L --fail --retry 5 --retry-delay 3 -o "public/models/$FILE" "$BASE/$FILE" || {
    echo "⚠️ Falha ao baixar $FILE — verifique URL ou versão."
  }
done

echo ""
echo "🧾 VERIFICAÇÃO FINAL:"
ls -lh public/models/
echo ""
echo "📏 TAMANHO TOTAL:"
du -h -d 1 public/models
echo ""
echo "✅ Download concluído!"
