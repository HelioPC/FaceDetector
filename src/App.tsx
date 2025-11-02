import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import CapturedImageAnalysis from './CapturedImageAnalysis';

type CameraState = 'no-permission' | 'permission-granted' | 'camera-active';
type DetectionStatus = 'none' | 'female' | 'male';

export default function App() {
  const [cameraState, setCameraState] = useState<CameraState>('no-permission');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [age, setAge] = useState<number>(0);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>('none');
  const [isSmiling, setIsSmiling] = useState(false);
  const [isLookingAtCamera, setIsLookingAtCamera] = useState<boolean>(false);
  const [confidence, setConfidence] = useState(0);
  const [framesAnalyzed, setFramesAnalyzed] = useState(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const loadApp = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.ageGenderNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        ]);
        console.log('✅ Modelos carregados com sucesso');
      } catch (err) {
        console.error('Erro ao carregar modelos:', err);
        alert('Falha ao carregar modelos de IA.');
      }
      setIsLoading(false);
    };
    loadApp();
  }, []);

  useEffect(() => {
    // Cleanup: parar stream quando componente desmonta
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const runDetection = async () => {
      if (!videoRef.current) return;

      const detections = await faceapi
        .detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.9 })
        )
        .withFaceLandmarks()
        .withAgeAndGender()
        .withFaceExpressions();

      if (detections.length > 0) {
        const best = detections[0];

        // 🔹 Atualiza métricas básicas
        setFramesAnalyzed((prev) => prev + 1);
        setConfidence(Math.round(best.detection.score * 100));

        // 🔹 Idade estimada
        setAge(Math.round(best.age));

        // 🔹 Género
        if (best.gender === 'female') {
          setDetectionStatus('female');
        } else if (best.gender === 'male') {
          setDetectionStatus('male');
        }

        // 🔹 Sorriso
        const smileProb = best.expressions.happy ?? 0;
        setIsSmiling(smileProb > 0.7);

        // 🔹 Verifica se está a olhar para a câmera
        const landmarks = best.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const nose = landmarks.getNose();

        if (leftEye && rightEye && nose) {
          const eyeCenterX = (leftEye[0].x + rightEye[3].x) / 2;
          const noseX = nose[3].x;
          const offset = Math.abs(noseX - eyeCenterX);

          // Threshold ajustável (quanto menor, mais centralizado o rosto)
          const isLooking = offset < 15;
          setIsLookingAtCamera(isLooking);
        } else {
          setIsLookingAtCamera(false);
        }
      } else {
        // 🔹 Reset quando não há rosto
        setDetectionStatus('none');
        setConfidence(0);
        setIsSmiling(false);
        setAge(0);
        setIsLookingAtCamera(false);
      }
    };

    if (cameraState === 'camera-active') {
      interval = setInterval(runDetection, 500);
    } else {
      setFramesAnalyzed(0);
      setDetectionStatus('none');
      setConfidence(0);
      setIsSmiling(false);
      setAge(0);
      setIsLookingAtCamera(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cameraState]);

  const requestPermission = async () => {
    try {
      // Apenas verificar se podemos acessar (não inicia o stream ainda)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');

      if (hasCamera) {
        setCameraState('permission-granted');
      }
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      alert('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraState('camera-active');
      }
    } catch (error) {
      console.error('Erro ao iniciar câmera:', error);
      alert('Não foi possível iniciar a câmera. Verifique as permissões.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = canvas.toDataURL('image/png');
        setCapturedImage(imageData);

        // Efeito visual de flash
        const viewfinder = document.getElementById('viewfinder');
        if (viewfinder) {
          viewfinder.style.opacity = '0.5';
          setTimeout(() => {
            viewfinder.style.opacity = '1';
          }, 100);
        }
      }
    }
  };

  const handleButtonClick = () => {
    switch (cameraState) {
      case 'no-permission':
        requestPermission();
        break;
      case 'permission-granted':
        startCamera();
        break;
      case 'camera-active':
        capturePhoto();
        break;
    }
  };

  const getButtonConfig = () => {
    switch (cameraState) {
      case 'no-permission':
        return {
          label: 'Solicitar Permissões',
          color: '#3A3A3A',
          hoverColor: '#2A2A2A'
        };
      case 'permission-granted':
        return {
          label: 'Ligar Câmera',
          color: '#007BFF',
          hoverColor: '#0056b3'
        };
      case 'camera-active':
        return {
          label: 'Capturar Fotografia',
          color: '#28A745',
          hoverColor: '#218838'
        };
    }
  };

  const buttonConfig = getButtonConfig();

  const clearCapturedImage = () => {
    setCapturedImage(null);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState('permission-granted');
  };

  // Configuração do círculo central baseado na detecção
  const getDetectionCircleColor = () => {
    switch (detectionStatus) {
      case 'none':
        return '#CDCDCD'; // Vermelho
      case 'female':
        return '#FF69B4'; // Rosa
      case 'male':
        return '#007BFF'; // Azul
    }
  };

  const getGenderLabel = () => {
    switch (detectionStatus) {
      case 'none':
        return '—';
      case 'female':
        return 'Feminino';
      case 'male':
        return 'Masculino';
    }
  };

  return (
    isLoading ? (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="loader mb-4"></div>
          <p className="text-gray-700">Carregando aplicação...</p>
        </div>
      </div>
    ) : (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 bg-white relative">
        {/* Botão para desligar câmera */}
        {cameraState === 'camera-active' && (
          <button
            onClick={stopCamera}
            className="fixed top-8 right-8 bg-red-600 hover:bg-red-500 text-white p-3 rounded-full transition-all duration-300 cursor-pointer shadow-lg"
            title="Desligar Câmera"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Título */}
        <h1 className="text-gray-900 text-center mb-8">
          Laboratório de Deteção de Gênero
        </h1>

        {/* Visor da Câmera */}
        <div
          id="viewfinder"
          className="relative bg-black rounded-2xl overflow-hidden transition-opacity duration-100"
          style={{
            width: '80vw',
            maxWidth: '1000px',
            height: '70vh',
            maxHeight: '700px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Vídeo da câmera */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraState === 'camera-active' ? 'block' : 'hidden'}`}
          />

          {/* Placeholder quando câmera não está ativa */}
          {cameraState !== 'camera-active' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-600">
                <svg
                  className="w-24 h-24 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p>Câmera Desligada</p>
              </div>
            </div>
          )}

          {/* Canvas oculto para captura */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Círculo Central de Detecção */}
          {cameraState === 'camera-active' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="rounded-full animate-pulse"
                style={{
                  width: '450px',
                  height: '450px',
                  backgroundColor: 'transparent',
                  border: `4px solid ${getDetectionCircleColor()}`,
                  opacity: 0.5,
                  boxShadow: `0 0 40px ${getDetectionCircleColor()}`,
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }}
              />
            </div>
          )}

          {/* Caixa de Estatísticas */}
          {cameraState === 'camera-active' && (
            <div
              className="absolute bottom-4 left-4 text-white p-4 rounded-lg"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(10px)',
                minWidth: '220px'
              }}
            >
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Olha para a câmera: </span>
                  <span>{isLookingAtCamera ? 'Sim' : 'Não'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Gênero:</span>
                  <span>{getGenderLabel()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Confiança:</span>
                  <span>{confidence}%</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-300'>Idade</span>
                  <span>{age}</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-300'>Sorrindo</span>
                  <span>{isSmiling ? 'Sim' : 'Não'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Frames:</span>
                  <span>{framesAnalyzed}</span>
                </div>
                <div className="flex justify-between mt-4">
                  <span className="text-gray-300 mr-2">Desenvolvido por:</span>
                  <span>Eliude Vemba</span>
                </div>
              </div>
            </div>
          )}

          {/* Indicador de gravação quando câmera ativa */}
          {cameraState === 'camera-active' && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 px-3 py-2 rounded-full backdrop-blur-sm">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white text-sm">AO VIVO</span>
            </div>
          )}
        </div>

        {/* Botão de Ação */}
        <button
          onClick={handleButtonClick}
          className="mt-8 px-12 py-4 rounded-xl text-white transition-all duration-300 cursor-pointer"
          style={{
            backgroundColor: buttonConfig.color,
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
            minWidth: '250px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = buttonConfig.hoverColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = buttonConfig.color;
          }}
        >
          {buttonConfig.label}
        </button>

        {/* Modal de Imagem Capturada */}
        {capturedImage && (
          <CapturedImageAnalysis
            capturedImage={capturedImage}
            onClose={clearCapturedImage}
          />
        )}
      </div>
    )
  );
}
