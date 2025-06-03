import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/*
=============================================================================
PROJETO: SIMULADOR DE PARTÍCULAS E ÁUDIO 3D
=============================================================================
DESCRIÇÃO: Aplicação web que cria visualização 3D de partículas reagindo 
          a análise de frequência de áudio WAV em tempo real

TECNOLOGIAS: Three.js, Web Audio API, WebGL
HARDWARE ALVO: Intel UHD Graphics 128MB, 8GB RAM, Core i5
PERFORMANCE: 30-60fps estável, 200-5000 partículas

FASES DE DESENVOLVIMENTO:
✅ FASE 1: Base + carregamento áudio (ATUAL)
- FASE 2: Sistema básico de partículas
- FASE 3: Análise avançada de frequência  
- FASE 4: Física gravitacional
- FASE 5: Interatividade completa
- FASE 6: Polimento profissional

FASE 1 - OBJETIVOS:
- Cena 3D com câmera orbital funcionando
- Interface para carregar arquivos WAV
- Sistema de áudio Web Audio API
- Controles play/pause/volume
- Visualização básica de waveform
- 60fps estável (sem partículas ainda)
=============================================================================
*/

// Variáveis globais - Cena 3D
let scene, camera, renderer, controls;

// Variáveis globais - Sistema de áudio
let audioContext, analyser, audioSource, audioBuffer, gainNode;
let isPlaying = false;
let currentAudioFile = null;

// Configurações globais
const CONFIG = {
    camera: { fov: 75, near: 0.1, far: 1000, position: [0, 5, 10] },
    audio: { fftSize: 1024, smoothing: 0.8 },
    renderer: { antialias: false, alpha: true }
};

// Função principal de inicialização
function init() {
    console.log('🚀 Iniciando Simulador de Partículas...');
    
    // Criar cena Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011); // azul muito escuro
    
    // Adicionar um cubo de teste
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    
    // Configurar câmera perspectiva
    camera = new THREE.PerspectiveCamera(
        CONFIG.camera.fov,
        window.innerWidth / window.innerHeight,
        CONFIG.camera.near,
        CONFIG.camera.far
    );
    camera.position.set(...CONFIG.camera.position);
    camera.lookAt(0, 0, 0);
    // NÃO adicionar camera à cena
    // Configurar renderizador WebGL
    renderer = new THREE.WebGLRenderer({
        antialias: CONFIG.renderer.antialias,
        alpha: CONFIG.renderer.alpha
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Adiciona o renderer ANTES do container da interface
    const container = document.getElementById('container');
    document.body.insertBefore(renderer.domElement, container);
    // Configurar controles orbitais
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.minDistance = 5;
    controls.maxDistance = 50;
    // Configurar contexto de áudio
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = CONFIG.audio.fftSize;
        analyser.smoothingTimeConstant = CONFIG.audio.smoothing;
        console.log('✅ Contexto de áudio inicializado com sucesso');
    } catch (error) {
        console.error('❌ Erro ao criar contexto de áudio:', error);
    }
    // Adicionar evento de resize
    window.addEventListener('resize', onWindowResize, false);
    // Iniciar renderização
    animate();
    console.log('✅ Simulador de Partículas iniciado com sucesso!');
}
// Função de animação
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
// Função de resize da janela
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}     
// Função para carregar arquivo de áudio
function loadAudioFile(file) {
    if (currentAudioFile) {
        URL.revokeObjectURL(currentAudioFile);
    }
    currentAudioFile = URL.createObjectURL(file);
    
    // Criar um FileReader para ler o arquivo como ArrayBuffer
    const reader = new FileReader();
    reader.onload = function(e) {
        // Decodificar o ArrayBuffer para AudioBuffer
        audioContext.decodeAudioData(e.target.result)
            .then(buffer => {
                audioBuffer = buffer;
                setupAudioSource();
                displayWaveform();
                console.log('✅ Arquivo de áudio carregado com sucesso!');
            })
            .catch(error => {
                console.error('❌ Erro ao decodificar áudio:', error);
            });
    };
    reader.onerror = function(error) {
        console.error('❌ Erro ao ler arquivo:', error);
    };
    reader.readAsArrayBuffer(file);
}   
// Função para configurar fonte de áudio
function setupAudioSource() {
    if (audioSource) {
        audioSource.disconnect();
    }
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;

    // Crie o GainNode se ainda não existir
    if (!gainNode) {
        gainNode = audioContext.createGain();
        gainNode.gain.value = document.getElementById('volumeSlider').value;
    }

    // Conecte a cadeia: source -> analyser -> gain -> destino
    audioSource.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioContext.destination);

    console.log('🔊 Fonte de áudio configurada com sucesso!');
}
// Função para tocar áudio
function playAudio() {
    if (!audioBuffer) {
        console.warn('⚠️ Nenhum áudio carregado para tocar.');
        return;
    }
    if (isPlaying && audioSource) {
        audioSource.stop();
        isPlaying = false;
    }
    setupAudioSource(); // Sempre cria um novo BufferSource
    audioSource.start(0);
    isPlaying = true;
    animateWaveform(); // Inicia a animação da waveform
    console.log('▶️ Áudio iniciado.');
}
// Função para pausar áudio
function pauseAudio() {
    if (isPlaying && audioSource) {
        audioSource.stop();
        isPlaying = false;
        // Limpa o canvas da waveform
        const waveformCanvas = document.getElementById('waveform');
        const ctx = waveformCanvas.getContext('2d');
        ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        displayWaveform(); // Mostra a waveform estática
        console.log('⏸️ Áudio pausado.');
    } else {
        console.warn('⚠️ Áudio já está pausado.');
    }
}
// Função para ajustar volume
function setVolume(value) {
    if (gainNode) {
        gainNode.gain.value = value;
        console.log(`🔊 Volume ajustado para: ${value}`);
    } else {
        console.warn('⚠️ Controle de volume não está disponível.');
    }
}
// Função para exibir waveform
function displayWaveform() {
    if (!audioBuffer) {
        console.warn('⚠️ Nenhum áudio carregado para exibir waveform.');
        return;
    }
    const waveformCanvas = document.getElementById('waveform');
    const ctx = waveformCanvas.getContext('2d');
    const data = audioBuffer.getChannelData(0);
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    // Amostragem proporcional ao tamanho do canvas
    const step = Math.ceil(data.length / width);
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum !== undefined) {
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
        }
        const y1 = (1 - (min + 1) / 2) * height;
        const y2 = (1 - (max + 1) / 2) * height;
        ctx.moveTo(i, y1);
        ctx.lineTo(i, y2);
    }
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.stroke();
    console.log('✅ Waveform exibida com sucesso!');
}
// Função para animar a waveform em tempo real
function animateWaveform() {
    const waveformCanvas = document.getElementById('waveform');
    const ctx = waveformCanvas.getContext('2d');
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    if (!analyser) return;
    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    for (let i = 0; i < width; i++) {
        const dataIndex = Math.floor(i / width * bufferLength);
        const v = dataArray[dataIndex] || 0;
        const y = (1 - (v + 1) / 2) * height;
        if (i === 0) {
            ctx.moveTo(i, y);
        } else {
            ctx.lineTo(i, y);
        }
    }
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.stroke();
    requestAnimationFrame(animateWaveform);
}
// Evento de carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    init();
    // Configurar eventos de carregamento de áudio
    const audioInput = document.getElementById('audioInput');
    audioInput.addEventListener('change', event => {
        const file = event.target.files[0];
        if (file && file.type === 'audio/wav') {
            loadAudioFile(file);
        } else {
            console.warn('⚠️ Por favor, selecione um arquivo WAV válido.');
        }
    });
    // Configurar eventos de controle de áudio
    document.getElementById('playButton').addEventListener('click', playAudio);
    document.getElementById('pauseButton').addEventListener('click', pauseAudio);
    document.getElementById('volumeSlider').addEventListener('input', event => {
        setVolume(event.target.value);
    });
});
// Exibir mensagem de boas-vindas
console.log('👋 Bem-vindo ao Simulador de Partículas e Áudio 3D!');
// Instruções de uso
console.log('📜 Instruções:')
console.log('1. Carregue um arquivo WAV usando o seletor de arquivos.');
console.log('2. Use os botões para tocar/pausar o áudio.'); 
console.log('3. Ajuste o volume com o controle deslizante.');
console.log('4. Visualize a forma de onda do áudio carregado.');
// Mensagem de encerramento
console.log('🚀 Simulador pronto para uso! Divirta-se explorando a interação entre áudio e partículas 3D!')
// Fim do script