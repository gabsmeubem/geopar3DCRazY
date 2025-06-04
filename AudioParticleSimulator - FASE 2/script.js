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
let cube; // Referência global ao cubo
let ring; // Referência global ao anel
let particles, particlesGeometry, particlesMaterial;

// Variáveis globais - Sistema de áudio
let audioContext, analyser, audioSource, audioBuffer, gainNode;
let isPlaying = false;
let currentAudioFile = null;

// Configurações globais
const CONFIG = {
    camera: { fov: 75, near: 0.1, far: 1000, position: [0, 5, 10] },
    audio: { fftSize: 1024, smoothing: 0.8 },
    renderer: { antialias: false, alpha: true },
    vibrationSpeed: 1.0 // Nova configuração para velocidade de vibração
};

// Constantes
const PARTICLE_COUNT = 400;

// Função principal de inicialização
function init() {
    console.log('🚀 Iniciando Simulador de Partículas...');
    
    // Criar cena Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011); // azul muito escuro
    
    // Adicionar um cubo de teste
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff99, emissive: 0x000000, metalness: 0.5, roughness: 0.4 });
    cube = new THREE.Mesh(geometry, material); // Salva referência global
    scene.add(cube);
    // Adicionar anel (torus) em volta do cubo
    const ringGeometry = new THREE.TorusGeometry(1.5, 0.13, 32, 128);
    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x00c3ff, emissive: 0x000000, metalness: 0.6, roughness: 0.3 });
    ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2; // Deixa o anel na horizontal
    scene.add(ring);
    // Iluminação para realçar o gradiente
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);
    
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
    // Adicionar sistema de partículas (FASE 2)
    particlesGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    // Distribui partículas em uma esfera ao redor do cubo/anel
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        const r = 2.2 + Math.random() * 0.5; // Raio ao redor do cubo/anel
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        colors[i * 3] = 0.0;
        colors[i * 3 + 1] = 0.7;
        colors[i * 3 + 2] = 1.0;
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Cria uma textura circular com gradiente radial (glow)
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 64;
    spriteCanvas.height = 64;
    const ctx = spriteCanvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(0,255,255,0.7)');
    gradient.addColorStop(0.5, 'rgba(0,128,255,0.3)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    const spriteMap = new THREE.Texture(spriteCanvas);
    spriteMap.needsUpdate = true;

    particlesMaterial = new THREE.PointsMaterial({ 
        size: 0.18, 
        vertexColors: true, 
        transparent: true, 
        opacity: 0.95, 
        sizeAttenuation: true,
        map: spriteMap, // Usa sprite circular com glow
        alphaTest: 0.05
    });
    particlesMaterial.depthWrite = false; // Evita artefatos de sobreposição
    particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
}
// Função de animação
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    deformCubeWithWaveform(); // Vibração do cubo
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
// Função utilitária para interpolar cor de gradiente
function getGradientColor(intensity) {
    // intensity: 0 (baixo) a 1 (alto)
    // Azul (#00c3ff) → Verde (#00ff99) → Amarelo (#fff700) → Vermelho (#ff2a00)
    const stops = [
        { stop: 0.0, color: new THREE.Color('#00c3ff') },
        { stop: 0.33, color: new THREE.Color('#00ff99') },
        { stop: 0.66, color: new THREE.Color('#fff700') },
        { stop: 1.0, color: new THREE.Color('#ff2a00') }
    ];
    for (let i = 0; i < stops.length - 1; i++) {
        if (intensity >= stops[i].stop && intensity <= stops[i + 1].stop) {
            const t = (intensity - stops[i].stop) / (stops[i + 1].stop - stops[i].stop);
            return stops[i].color.clone().lerp(stops[i + 1].color, t);
        }
    }
    return stops[stops.length - 1].color;
}
// Função para deformar o cubo conforme a waveform do áudio
function deformCubeWithWaveform() {
    if (!analyser || !cube) return;
    const geometry = cube.geometry;
    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    if (!geometry.userData.originalPositions) {
        geometry.userData.originalPositions = position.array.slice();
    }
    const original = geometry.userData.originalPositions;
    // Calcular intensidade média (RMS) do frame para o gradiente
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += dataArray[i] * dataArray[i];
    const rms = Math.sqrt(sum / bufferLength); // 0 a ~1
    const normIntensity = Math.min(rms * 4, 1.0);
    const gradColor = getGradientColor(normIntensity);
    cube.material.color.copy(gradColor);
    cube.material.emissive.copy(gradColor.clone().multiplyScalar(normIntensity * 0.7));
    // Vibração do cubo
    for (let i = 0; i < position.count; i++) {
        const dataIndex = Math.floor(i / position.count * bufferLength);
        const amp = dataArray[dataIndex] || 0;
        const intensity = 0.2;
        const ox = original[i * 3];
        const oy = original[i * 3 + 1];
        const oz = original[i * 3 + 2];
        const nx = normal.array[i * 3];
        const ny = normal.array[i * 3 + 1];
        const nz = normal.array[i * 3 + 2];
        position.array[i * 3]     = ox + nx * amp * intensity;
        position.array[i * 3 + 1] = oy + ny * amp * intensity;
        position.array[i * 3 + 2] = oz + nz * amp * intensity;
    }
    position.needsUpdate = true;
    // geometry.computeVertexNormals(); // Removido do loop para performance
    // Vibração do anel
    if (ring) {
        const ringGeometry = ring.geometry;
        const ringPosition = ringGeometry.attributes.position;
        const ringNormal = ringGeometry.attributes.normal;
        if (!ringGeometry.userData.originalPositions) {
            ringGeometry.userData.originalPositions = ringPosition.array.slice();
        }
        const ringOriginal = ringGeometry.userData.originalPositions;
        ring.material.color.copy(gradColor);
        ring.material.emissive.copy(gradColor.clone().multiplyScalar(normIntensity * 0.7));
        for (let i = 0; i < ringPosition.count; i++) {
            const dataIndex = Math.floor(i / ringPosition.count * bufferLength);
            const amp = dataArray[dataIndex] || 0;
            const intensity = 0.18 + normIntensity * 0.12;
            const ox = ringOriginal[i * 3];
            const oy = ringOriginal[i * 3 + 1];
            const oz = ringOriginal[i * 3 + 2];
            const nx = ringNormal.array[i * 3];
            const ny = ringNormal.array[i * 3 + 1];
            const nz = ringNormal.array[i * 3 + 2];
            ringPosition.array[i * 3]     = ox + nx * amp * intensity;
            ringPosition.array[i * 3 + 1] = oy + ny * amp * intensity;
            ringPosition.array[i * 3 + 2] = oz + nz * amp * intensity;
        }
        ringPosition.needsUpdate = true;
        // ringGeometry.computeVertexNormals(); // Removido do loop para performance
    }
    // Atualizar partículas (FASE 2 - animação)
    if (particles && particlesGeometry) {
        const posAttr = particlesGeometry.attributes.position;
        const colorAttr = particlesGeometry.attributes.color;
        if (!particlesGeometry.userData.originalPositions) {
            particlesGeometry.userData.originalPositions = posAttr.array.slice();
        }
        const orig = particlesGeometry.userData.originalPositions;
        // FFT para análise de frequências
        const freqSize = analyser.frequencyBinCount;
        const freqData = new Uint8Array(freqSize);
        analyser.getByteFrequencyData(freqData);
        // Define 4 grupos de frequência: graves, médios, agudos, superagudos
        const groupCount = 4;
        const groupRanges = [
            [0, Math.floor(freqSize * 0.15)],      // Graves
            [Math.floor(freqSize * 0.15), Math.floor(freqSize * 0.4)], // Médios
            [Math.floor(freqSize * 0.4), Math.floor(freqSize * 0.7)],  // Agudos
            [Math.floor(freqSize * 0.7), freqSize]                     // Superagudos
        ];
        // Calcula energia média de cada grupo
        const groupEnergy = groupRanges.map(([start, end]) => {
            let sum = 0;
            for (let i = start; i < end; i++) sum += freqData[i];
            return sum / (end - start);
        });
        // Para cada partícula, define grupo e cor conforme energia
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Agrupa partículas em "faixas" ao redor do cubo
            const group = Math.floor(i / (PARTICLE_COUNT / groupCount));
            // Vetor radial original
            const ox = orig[i * 3];
            const oy = orig[i * 3 + 1];
            const oz = orig[i * 3 + 2];
            const len = Math.sqrt(ox*ox + oy*oy + oz*oz) || 1;
            // Vibração conforme energia do grupo
            const amp = (groupEnergy[group] / 255) * 1.2; // Normaliza
            const vib = 0.18 + amp * 0.35;
            posAttr.array[i * 3]     = ox + (ox/len) * amp * vib;
            posAttr.array[i * 3 + 1] = oy + (oy/len) * amp * vib;
            posAttr.array[i * 3 + 2] = oz + (oz/len) * amp * vib;
            // Cor: cada grupo tem um gradiente próprio
            let color;
            if (group === 0) color = new THREE.Color().setHSL(0.58, 1, 0.6); // Graves: azul
            else if (group === 1) color = new THREE.Color().setHSL(0.33, 1, 0.6); // Médios: verde
            else if (group === 2) color = new THREE.Color().setHSL(0.13, 1, 0.6); // Agudos: amarelo
            else color = new THREE.Color().setHSL(0.0, 1, 0.6); // Superagudos: vermelho
            // Intensidade do grupo modula brilho
            color.lerp(new THREE.Color('white'), amp * 0.7);
            colorAttr.array[i * 3] = color.r;
            colorAttr.array[i * 3 + 1] = color.g;
            colorAttr.array[i * 3 + 2] = color.b;
        }
        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
    }
}
// Update particle colors and positions to dynamically synchronize with the cube's vibration
function updateParticles(frequencyData) {
    const bassRange = [0, 64];
    const midRange = [65, 256];
    const trebleRange = [257, 512];
    const superTrebleRange = [513, 1024];

    const bassIntensity = getFrequencyIntensity(frequencyData, bassRange);
    const midIntensity = getFrequencyIntensity(frequencyData, midRange);
    const trebleIntensity = getFrequencyIntensity(frequencyData, trebleRange);
    const superTrebleIntensity = getFrequencyIntensity(frequencyData, superTrebleRange);

    const positionArray = particlesGeometry.attributes.position.array;
    const colorArray = particlesGeometry.attributes.color.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const group = i % 4; // Assign particles to groups
        let intensity;
        let color;

        switch (group) {
            case 0: // Bass group
                intensity = bassIntensity;
                color = new THREE.Color(1, 0.2, 0.2); // Vibrant red
                break;
            case 1: // Mid group
                intensity = midIntensity;
                color = new THREE.Color(0.2, 1, 0.2); // Vibrant green
                break;
            case 2: // Treble group
                intensity = trebleIntensity;
                color = new THREE.Color(0.2, 0.2, 1); // Vibrant blue
                break;
            case 3: // Super-treble group
                intensity = superTrebleIntensity;
                color = new THREE.Color(1, 1, 0.2); // Vibrant yellow
                break;
        }

        // Amplify particle movement to make them more dynamic
        const movementFactor = intensity * CONFIG.vibrationSpeed * 2.0;
        positionArray[i * 3] += (Math.random() - 0.5) * movementFactor; // X-axis
        positionArray[i * 3 + 1] += (Math.random() - 0.5) * movementFactor; // Y-axis
        positionArray[i * 3 + 2] += (Math.random() - 0.5) * movementFactor; // Z-axis

        // Update particle color dynamically
        colorArray[i * 3] = color.r * intensity;
        colorArray[i * 3 + 1] = color.g * intensity;
        colorArray[i * 3 + 2] = color.b * intensity;
    }

    particlesGeometry.attributes.position.needsUpdate = true;
    particlesGeometry.attributes.color.needsUpdate = true;
}
// Função para obter a intensidade da frequência em um intervalo específico
function getFrequencyIntensity(frequencyData, [minFreq, maxFreq]) {
    let sum = 0;
    let count = 0;
    for (let i = minFreq; i <= maxFreq && i < frequencyData.length; i++) {
        sum += frequencyData[i];
        count++;
    }
    return count > 0 ? sum / count : 0;
}
// Adicionar ouvintes de evento para os controles deslizantes
const particleSizeSlider = document.getElementById('particleSizeSlider');
const glowIntensitySlider = document.getElementById('glowIntensitySlider');
const vibrationSpeedSlider = document.getElementById('vibrationSpeedSlider');

particleSizeSlider.addEventListener('input', (event) => {
    const size = parseFloat(event.target.value);
    particlesMaterial.size = size;
    particlesMaterial.needsUpdate = true;
});

glowIntensitySlider.addEventListener('input', (event) => {
    const intensity = parseFloat(event.target.value);
    particlesMaterial.opacity = intensity;
    particlesMaterial.needsUpdate = true;
});

vibrationSpeedSlider.addEventListener('input', (event) => {
    const speed = parseFloat(event.target.value);
    CONFIG.vibrationSpeed = speed;
});
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