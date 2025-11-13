import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

interface Props {
  capturedImage: string;
  onClose: () => void;
}

const CapturedImageAnalysis: React.FC<Props> = ({ capturedImage, onClose }) => {
  const imageRef = useRef<HTMLImageElement>(null);

  const [loading, setLoading] = useState(true);
  const [gender, setGender] = useState<string>("—");
  const [age, setAge] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [isSmiling, setIsSmiling] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const analyzeImage = async () => {
      try {
        setLoading(true);
        setError("");

        // Carrega os modelos (se ainda não estiverem carregados)
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);

        if (!imageRef.current) return;

        // Executa a deteção
        const detections = await faceapi
          .detectAllFaces(
            imageRef.current,
            new faceapi.SsdMobilenetv1Options({
              minConfidence: 0.5,
              maxResults: 1,
            })
          )
          .withFaceLandmarks()
          .withAgeAndGender()
          .withFaceExpressions();

        if (detections.length === 0) {
          setError("Nenhum rosto detectado na imagem.");
          setLoading(false);
          return;
        }

        const best = detections[0];
        setGender(best.gender === "male" ? "Masculino" : "Feminino");
        setAge(Math.round(best.age));
        setConfidence(Math.round(best.detection.score * 100));
        setIsSmiling((best.expressions.happy ?? 0) > 0.7);
      } catch (err) {
        console.error(err);
        setError("Erro ao processar a imagem.");
      } finally {
        setLoading(false);
      }
    };

    analyzeImage();
  }, [capturedImage]);

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] text-white" onClick={(e) => e.stopPropagation()}>
        {/* Botão de fechar */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Imagem */}
        <img
          ref={imageRef}
          src={capturedImage}
          alt="Fotografia capturada"
          className="max-w-full max-h-[85vh] rounded-lg shadow-lg"
        />

        {/* Painel de resultados */}
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-3 rounded-lg text-sm space-y-1">
          {loading ? (
            <p className="text-gray-300">A processar imagem...</p>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : (
            <>
              <p><span className="font-semibold">Género:</span> {gender}</p>
              <p><span className="font-semibold">Idade estimada:</span> {age} anos</p>
              <p><span className="font-semibold">Sorriso:</span> {isSmiling ? "Sim 😄" : "Não 😐"}</p>
              <p><span className="font-semibold">Confiança:</span> {confidence}%</p>
            </>
          )}
        </div>

        <p className="text-white text-center mt-4 opacity-70">Clique fora da imagem para fechar</p>
      </div>
    </div>
  );
};

export default CapturedImageAnalysis;