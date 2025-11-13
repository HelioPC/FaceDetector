import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import CapturedImageAnalysis from './CapturedImageAnalysis';

// 8R0r9DyJudO6hjCU

type CameraState = 'no-permission' | 'permission-granted' | 'camera-active';
type DetectionStatus = 'none' | 'female' | 'male';

export default function App() {
  const [cameraState, setCameraState] = useState<CameraState>('no-permission');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [faceData, setFaceData] = useState({
    age: 0,
    gender: 'none' as DetectionStatus,
    isSmiling: false,
    isLooking: false,
    confidence: 0,
    frames: 0
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);  // para desenho
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);  // para foto
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      setIsLoading(true);
      const modelPath = '/models';

      try {
        console.log('🧠 Carregando modelos da Face API a partir de', modelPath);

        // Usa o SSD MobileNet v1 (mais preciso que o Tiny Face Detector)
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
          faceapi.nets.faceExpressionNet.loadFromUri(modelPath),
          faceapi.nets.ageGenderNet.loadFromUri(modelPath),
        ]);

        console.log('✅ Todos os modelos carregados com sucesso');
      } catch (err) {
        console.error('❌ Erro ao carregar modelos:', err);
        alert('Falha ao carregar modelos de IA. Verifique se a pasta /public/models existe e contém os ficheiros corretos.');
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();
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
    let animationFrameId: number | null = null;
    let lastDetectionTime = 0;
    const DETECTION_INTERVAL = 500; // 500ms entre detecções

    const runDetection = async (currentTime: number) => {
      if (cameraState !== 'camera-active') {
        return
      }
      if (currentTime - lastDetectionTime < DETECTION_INTERVAL) {
        if (cameraState === 'camera-active') {
          animationFrameId = requestAnimationFrame(runDetection);
        }
        return;
      }

      const video = videoRef.current;
      const canvas = overlayCanvasRef.current;
      if (!video || !canvas) {
        animationFrameId = requestAnimationFrame(runDetection);
        return;
      }

      // ESPERA O VÍDEO TER DIMENSÕES
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrameId = requestAnimationFrame(runDetection);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        const detections = await faceapi
          .detectAllFaces(
            video,
            new faceapi.SsdMobilenetv1Options({
              minConfidence: 0.5,
              maxResults: 2,
            })
          )
          .withFaceLandmarks()
          .withAgeAndGender()
          .withFaceExpressions();

        // REDIMENSIONA CANVAS
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length > 0) {
          const best = detections.reduce((prev, curr) => {
            const prevArea = prev.detection.box.width * prev.detection.box.height;
            const currArea = curr.detection.box.width * curr.detection.box.height;
            return currArea > prevArea ? curr : prev;
          }, detections[0]);

          const smileProb = best.expressions.happy ?? 0;
          const isSmiling = smileProb > 0.7;

          const landmarks = best.landmarks;
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();
          const nose = landmarks.getNose();
          let isLooking = false;
          if (leftEye && rightEye && nose) {
            const eyeCenterX = (leftEye[0].x + rightEye[3].x) / 2;
            const noseX = nose[3].x;
            const offset = Math.abs(noseX - eyeCenterX);
            isLooking = offset < 18;
          }

          setFaceData({
            age: Math.round(best.age),
            gender: best.gender === 'female' ? 'female' : best.gender === 'male' ? 'male' : 'none',
            isSmiling,
            isLooking,
            confidence: Math.round(best.detection.score * 100),
            frames: faceData.frames + 1
          });

          // DESENHA
          const resized = faceapi.resizeResults(detections, displaySize);

          faceapi.draw.drawDetections(canvas, resized);
          faceapi.draw.drawFaceLandmarks(canvas, resized);
          faceapi.draw.drawFaceExpressions(canvas, resized, 0.05);

          // TEXTO
          const box = resized[0].detection.box;
          const text = `${best.gender === 'male' ? 'Masculino' : 'Feminino'} | ${Math.round(best.age)} anos`;
          ctx.font = 'bold 20px Arial';
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          const textWidth = ctx.measureText(text).width;
          ctx.fillRect(box.x, box.y - 35, textWidth + 20, 35);
          ctx.fillStyle = 'white';
          ctx.fillText(text, box.x + 10, box.y - 10);
        } else {
          setFaceData(prev => ({
            ...prev,
            age: 0,
            gender: 'none',
            isSmiling: false,
            isLooking: false,
            confidence: 0
          }));
        }

        lastDetectionTime = currentTime;
      } catch (err) {
        console.error('Erro na detecção:', err);
      }

      if (cameraState === 'camera-active') {
        animationFrameId = requestAnimationFrame(runDetection);
      }
    };

    // === Inicia ou para o loop ===
    if (cameraState === 'camera-active') {
      animationFrameId = requestAnimationFrame(runDetection);
    } else {
      // Reset total
      setFaceData({
        age: 0,
        gender: 'none',
        isSmiling: false,
        isLooking: false,
        confidence: 0,
        frames: 0
      });
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d', { willReadFrequently: true });
        ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }

    // === Cleanup ===
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [cameraState, faceData.frames]); // Adicione faceData.frames se for externo

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
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current!.onloadedmetadata = () => {
          videoRef.current!.play();
        };
        setCameraState('camera-active');
      }
    } catch (error) {
      console.error('Erro ao iniciar câmera:', error);
      alert('Não foi possível iniciar a câmera. Verifique as permissões.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && captureCanvasRef.current) {
      const video = videoRef.current;
      const canvas = captureCanvasRef.current;
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
    switch (faceData.gender) {
      case 'none':
        return '#CDCDCD'; // Vermelho
      case 'female':
        return '#FF69B4'; // Rosa
      case 'male':
        return '#007BFF'; // Azul
    }
  };

  const getGenderLabel = () => {
    switch (faceData.gender) {
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
          Laboratório de Deteção Facial
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

          <canvas ref={captureCanvasRef} className="hidden" />

          {/* Canvas oculto para captura */}
          {cameraState === 'camera-active' && (
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ zIndex: 10 }}
            />
          )}

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
                  <span>{faceData.isLooking ? 'Sim' : 'Não'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Gênero:</span>
                  <span>{getGenderLabel()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Confiança:</span>
                  <span>{faceData.confidence}%</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-300'>Idade</span>
                  <span>{faceData.age}</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-300'>Sorrindo</span>
                  <span>{faceData.isSmiling ? 'Sim' : 'Não'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Frames:</span>
                  <span>{faceData.frames}</span>
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
