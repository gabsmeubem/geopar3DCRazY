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
let isAnimating = true; // Controls animation loop

// Configurações globais
const CONFIG = {
    camera: { fov: 75, near: 0.1, far: 1000, position: [0, 5, 10] },
    audio: { fftSize: 1024, smoothing: 0.8 },
    renderer: { antialias: false, alpha: true },
    vibrationSpeed: 1.0, // Nova configuração para velocidade de vibração
    debugMode: true, // Ativar modo de depuração
    frequencyMapping: 'logarithmic',
    smoothingFactor: 0.7
};

// Constantes
const PARTICLE_COUNT = 400;

// =============================
// FASE 3: 16 BANDAS DE FREQUÊNCIA
// =============================
const FREQUENCY_BANDS = {
    count: 16,
    ranges: [
        // Graves profundos
        { name: 'SubBass', min: 20, max: 60, color: '#ff0000' },
        { name: 'Bass', min: 60, max: 120, color: '#ff4400' },
        { name: 'LowBass', min: 120, max: 200, color: '#ff8800' },
        { name: 'HighBass', min: 200, max: 320, color: '#ffaa00' },
        // Médios
        { name: 'LowMid', min: 320, max: 500, color: '#ffdd00' },
        { name: 'Mid', min: 500, max: 800, color: '#ddff00' },
        { name: 'HighMid', min: 800, max: 1200, color: '#88ff00' },
        { name: 'UpperMid', min: 1200, max: 2000, color: '#44ff00' },
        // Agudos
        { name: 'LowTreble', min: 2000, max: 3200, color: '#00ff44' },
        { name: 'Treble', min: 3200, max: 5000, color: '#00ff88' },
        { name: 'HighTreble', min: 5000, max: 8000, color: '#00ffdd' },
        { name: 'SuperTreble', min: 8000, max: 12000, color: '#00ddff' },
        // Ultra agudos
        { name: 'Brilliance1', min: 12000, max: 16000, color: '#0088ff' },
        { name: 'Brilliance2', min: 16000, max: 20000, color: '#0044ff' },
        { name: 'Air1', min: 20000, max: 22000, color: '#4400ff' },
        { name: 'Air2', min: 22000, max: 24000, color: '#8800ff' }
    ]
};

// =============================
// FASE 3: VARIÁVEIS PARA ANÁLISE AVANÇADA
// =============================
// Armazena os dados suavizados das 16 bandas
let previousFrequencyData = new Float32Array(16);
const transientDetection = {
    threshold: 0.1,      // Minimum amplitude difference to be considered a transient
    sensitivity: 2.0,    // Multiplier for transient detection
    decayRate: 0.85,    // How quickly transients decay
    enabled: true       // Toggle transient detection
};

let peakHistory = new Float32Array(16); // Store previous peaks for decay

// Função principal de inicialização
function init() {
    console.log('🚀 Iniciando Simulador de Partículas...');
    isAnimating = true; // Ensure animation starts when initializing
    
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
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100vw';
    renderer.domElement.style.height = '100vh';
    renderer.domElement.style.zIndex = '1';
    // Remove any existing Three.js renderer canvas to prevent duplicates
    const oldCanvases = Array.from(document.querySelectorAll('canvas')).filter(c => c !== document.getElementById('waveform'));
    oldCanvases.forEach(c => c.parentNode && c.parentNode.removeChild(c));
    // Insert renderer canvas as first child of body (behind all UI)
    document.body.insertBefore(renderer.domElement, document.body.firstChild);
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

    // Inicializar sistema de rastros (FASE 3)
    initTrailSystem();
}
// Função de animação
function animate() {
    if (!isAnimating) return;
    requestAnimationFrame(animate);

    // Update controls
    controls.update();

    // Audio analysis
    if (analyser && isPlaying) {
        // Initialize dataArray for frequency data
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(frequencyData);

        // Get logarithmic frequency bands
        const bands = getLogarithmicFrequencyBands(frequencyData);
        
        // Apply smoothing
        const smoothedBands = smoothFrequencyData(bands, previousFrequencyData);
        
        // Detect transients
        const transients = detectTransients(smoothedBands, previousFrequencyData);
        
        // Update visualizations
        updateCentralObjects(smoothedBands);
        updateAdvancedParticles(smoothedBands, transients);
        
        // Update trails if enabled
        if (trailSystem.enabled) {
            updateTrailSystem();
        }
        
        // Store current bands for next frame
        previousFrequencyData.set(smoothedBands);
        
        // Performance monitoring in debug mode
        if (CONFIG.debugMode) {
            logFrequencyAnalysis(smoothedBands, transients);
        }
    }

    // Render scene
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
    isAnimating = true; // Resume animation when audio plays
    animateWaveform(); // Inicia a animação da waveform
    console.log('▶️ Áudio iniciado.');
}
// Função para pausar áudio
function pauseAudio() {
    if (isPlaying && audioSource) {
        audioSource.stop();
        isPlaying = false;
        isAnimating = false; // Stop animation when audio is paused
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
    // Garante que particlesGeometry e seus atributos existem antes de acessar
    if (!particlesGeometry || !particlesGeometry.attributes || !particlesGeometry.attributes.position || !particlesGeometry.attributes.color) {
        return;
    }
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
// =============================
// FASE 3: SUAVIZAÇÃO TEMPORAL DAS BANDAS
// =============================
/**
 * Suaviza os dados de frequência para evitar jittering visual.
 * @param {Float32Array} currentData - Dados atuais das bandas
 * @param {Float32Array} previousData - Dados do frame anterior
 * @param {number} smoothingFactor - Fator de suavização (0.1 a 0.9)
 * @returns {Float32Array} Dados suavizados
 */
function smoothFrequencyData(currentData, previousData, smoothingFactor = 0.7) {
    const smoothedData = new Float32Array(currentData.length);
    for (let i = 0; i < currentData.length; i++) {
        smoothedData[i] = previousData[i] * smoothingFactor + 
                         currentData[i] * (1 - smoothingFactor);
    }
    return smoothedData;
}
// =============================
// FASE 3: MAPEAMENTO LOGARÍTMICO DAS 16 BANDAS
// =============================
/**
 * Converte os dados de frequência FFT para 16 bandas logarítmicas especializadas.
 * @param {Uint8Array|Float32Array} frequencyData - Dados FFT do Analyser
 * @returns {Float32Array} 16 valores médios por banda
 */
function getLogarithmicFrequencyBands(frequencyData) {
    const bands = new Float32Array(16);
    const sampleRate = audioContext.sampleRate;
    const nyquist = sampleRate / 2;
    for (let i = 0; i < FREQUENCY_BANDS.count; i++) {
        const band = FREQUENCY_BANDS.ranges[i];
        const startBin = Math.floor(band.min / nyquist * frequencyData.length);
        const endBin = Math.floor(band.max / nyquist * frequencyData.length);
        let sum = 0;
        let count = 0;
        for (let j = startBin; j <= endBin && j < frequencyData.length; j++) {
            sum += frequencyData[j];
            count++;
        }
        bands[i] = count > 0 ? sum / count : 0;
    }
    return bands;
}

// =============================
// FASE 3: ESCALA MEL E ADSR
// =============================

// Conversão para escala Mel
function freqToMel(freq) {
    return 2595 * Math.log10(1 + freq / 700);
}

function melToFreq(mel) {
    return 700 * (Math.pow(10, mel / 2595) - 1);
}

function getMelFrequencyBands(frequencyData) {
    const bands = new Float32Array(16);
    const sampleRate = audioContext.sampleRate;
    const nyquist = sampleRate / 2;
    
    // Criar escala Mel uniforme
    const minMel = freqToMel(20);
    const maxMel = freqToMel(24000);
    const melStep = (maxMel - minMel) / 16;
    
    for (let i = 0; i < 16; i++) {
        const melStart = minMel + i * melStep;
        const melEnd = melStart + melStep;
        const freqStart = melToFreq(melStart);
        const freqEnd = melToFreq(melEnd);
        
        const startBin = Math.floor(freqStart / nyquist * frequencyData.length);
        const endBin = Math.floor(freqEnd / nyquist * frequencyData.length);
        
        let sum = 0;
        let count = 0;
        for (let j = startBin; j <= endBin && j < frequencyData.length; j++) {
            sum += frequencyData[j];
            count++;
        }
        bands[i] = count > 0 ? sum / count : 0;
    }
    
    return bands;
}

// Sistema ADSR
const adsrSystem = {
    state: 'release', // 'attack', 'decay', 'sustain', 'release'
    settings: {
        attack: 0.1,
        decay: 0.5,
        sustain: 0.7,
        release: 1.0
    },
    currentValue: 0,
    lastUpdate: 0,
    
    update: function() {
        const now = performance.now();
        const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds
        this.lastUpdate = now;
        
        switch (this.state) {
            case 'attack':
                this.currentValue += deltaTime / this.settings.attack;
                if (this.currentValue >= 1) {
                    this.currentValue = 1;
                    this.state = 'decay';
                }
                break;
                
            case 'decay':
                this.currentValue -= deltaTime / this.settings.decay * (1 - this.settings.sustain);
                if (this.currentValue <= this.settings.sustain) {
                    this.currentValue = this.settings.sustain;
                    this.state = 'sustain';
                }
                break;
                
            case 'sustain':
                this.currentValue = this.settings.sustain;
                break;
                
            case 'release':
                this.currentValue -= deltaTime / this.settings.release * this.settings.sustain;
                if (this.currentValue <= 0) {
                    this.currentValue = 0;
                }
                break;
        }
        
        return this.currentValue;
    },
    
    trigger: function() {
        this.state = 'attack';
        this.lastUpdate = performance.now();
    },
    
    release: function() {
        this.state = 'release';
    }
};
// =============================
// FASE 3: FUNÇÃO PRINCIPAL DE ANÁLISE AVANÇADA
// =============================
/**
 * Realiza análise avançada de áudio, atualizando bandas, transientes e partículas.
 * Substitui deformCubeWithWaveform() na animação.
 */
function advancedAudioAnalysis() {
    if (!analyser || !isPlaying) return;

    // Verificar performance e pular frames se necessário
    if (!adaptivePerformance.update()) return;

    // Atualizar grid espacial
    spatialGrid.update();

    // Atualizar frustum culling
    frustumCulling.update(camera);

    // Obter dados de frequência
    const bufferLength = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(frequencyData);

    // Converter para bandas de acordo com o mapeamento selecionado
    let bands;
    switch (CONFIG.frequencyMapping) {
        case 'mel':
            bands = getMelFrequencyBands(frequencyData);
            break;
        case 'linear':
            // Divisão linear simples do espectro
            bands = new Float32Array(16);
            const binSize = Math.floor(frequencyData.length / 16);
            for (let i = 0; i < 16; i++) {
                let sum = 0;
                for (let j = 0; j < binSize; j++) {
                    sum += frequencyData[i * binSize + j] || 0;
                }
                bands[i] = sum / binSize;
            }
            break;
        default: // 'logarithmic'
            bands = getLogarithmicFrequencyBands(frequencyData);
    }

    // Aplicar envoltória ADSR
    const adsrValue = adsrSystem.update();
    for (let i = 0; i < bands.length; i++) {
        bands[i] *= adsrValue;
    }

    // Aplicar intensidade personalizada por banda
    for (let i = 0; i < bands.length; i++) {
        const band = FREQUENCY_BANDS.ranges[i];
        if (band.intensity !== undefined) {
            bands[i] *= band.intensity;
        }
    }

    // Aplicar suavização temporal
    const smoothedBands = smoothFrequencyData(bands, previousFrequencyData, CONFIG.smoothingFactor);

    // Detectar transientes
    const transients = detectTransients(smoothedBands, previousFrequencyData);

    // Atualizar partículas com dados avançados
    updateAdvancedParticles(smoothedBands, transients);

    // Atualizar cubo/anel central
    updateCentralObjects(smoothedBands);

    // Atualizar sistema de rastros
    if (trailSystem.enabled) {
        updateTrailSystem();
    }

    // Salvar dados para próximo frame
    previousFrequencyData.set(smoothedBands);

    // Debug (se ativado)
    if (CONFIG.debugMode) {
        logFrequencyAnalysis(smoothedBands, transients);
    }
}

function logFrequencyAnalysis(bands, transients) {
    console.debug('🎵 Análise de Frequência:');
    console.debug('Graves dominantes:', bands.slice(0, 4).reduce((a, b) => a + b) / 4);
    console.debug('Médios dominantes:', bands.slice(4, 8).reduce((a, b) => a + b) / 4);
    console.debug('Agudos dominantes:', bands.slice(8, 12).reduce((a, b) => a + b) / 4);
    console.debug('Ultra-agudos:', bands.slice(12, 16).reduce((a, b) => a + b) / 4);
    console.debug('Transientes detectados:', transients.filter(t => t > 0.5).length);
}

function updateAdvancedParticles(bands, transients) {
    if (!particlesGeometry || !particlesGeometry.attributes) return;
    
    const posAttr = particlesGeometry.attributes.position;
    const colorAttr = particlesGeometry.attributes.color;
    if (!particlesGeometry.userData.originalPositions) {
        particlesGeometry.userData.originalPositions = posAttr.array.slice();
    }
    const orig = particlesGeometry.userData.originalPositions;
    const PARTICLES_PER_BAND = Math.floor(PARTICLE_COUNT / 16);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const bandIndex = Math.floor(i / PARTICLES_PER_BAND);
        const bandAmplitude = bands[bandIndex] / 255;
        const transientValue = transients[bandIndex];
        
        // Position update with transient influence
        const baseIndex = i * 3;
        const ox = orig[baseIndex];
        const oy = orig[baseIndex + 1];
        const oz = orig[baseIndex + 2];
        const len = Math.sqrt(ox*ox + oy*oy + oz*oz) || 1;
        
        // Add more dynamic movement based on transients
        const vibrationIntensity = 0.2 + (transientValue * 0.3);
        const displacement = bandAmplitude * vibrationIntensity;
        
        posAttr.array[baseIndex] = ox + (ox/len) * displacement;
        posAttr.array[baseIndex + 1] = oy + (oy/len) * displacement;
        posAttr.array[baseIndex + 2] = oz + (oz/len) * displacement;
        
        // Color update based on frequency band and transient
        const bandColor = new THREE.Color(FREQUENCY_BANDS.ranges[bandIndex].color);
        const intensity = 0.3 + (bandAmplitude * 0.7) + (transientValue * 0.3);
        bandColor.multiplyScalar(intensity);
        
        colorAttr.array[baseIndex] = bandColor.r;
        colorAttr.array[baseIndex + 1] = bandColor.g;
        colorAttr.array[baseIndex + 2] = bandColor.b;
    }
    
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
}

function updateCentralObjects(bands) {
    if (!cube || !ring) return;
    
    // Calculate overall intensity for base effects
    const bassIntensity = (bands[0] + bands[1]) / (2 * 255);
    const midIntensity = (bands[4] + bands[5]) / (2 * 255);
    const highIntensity = (bands[8] + bands[9]) / (2 * 255);
    
    // Update cube
    const cubeGeometry = cube.geometry;
    const cubePosition = cubeGeometry.attributes.position;
    if (!cubeGeometry.userData.originalPositions) {
        cubeGeometry.userData.originalPositions = cubePosition.array.slice();
    }
    const cubeOriginal = cubeGeometry.userData.originalPositions;
    
    // Deform cube based on frequency intensities
    for (let i = 0; i < cubePosition.count; i++) {
        const baseIndex = i * 3;
        const deformation = bassIntensity * 0.3 + midIntensity * 0.2;
        
        cubePosition.array[baseIndex] = cubeOriginal[baseIndex] * (1 + deformation);
        cubePosition.array[baseIndex + 1] = cubeOriginal[baseIndex + 1] * (1 + deformation);
        cubePosition.array[baseIndex + 2] = cubeOriginal[baseIndex + 2] * (1 + deformation);
    }
    
    // Update ring
    const ringGeometry = ring.geometry;
    const ringPosition = ringGeometry.attributes.position;
    if (!ringGeometry.userData.originalPositions) {
        ringGeometry.userData.originalPositions = ringPosition.array.slice();
    }
    const ringOriginal = ringGeometry.userData.originalPositions;
    
    // Deform ring based on high frequencies
    for (let i = 0; i < ringPosition.count; i++) {
        const baseIndex = i * 3;
        const deformation = highIntensity * 0.4;
        
        ringPosition.array[baseIndex] = ringOriginal[baseIndex] * (1 + deformation);
        ringPosition.array[baseIndex + 1] = ringOriginal[baseIndex + 1] * (1 + deformation);
        ringPosition.array[baseIndex + 2] = ringOriginal[baseIndex + 2] * (1 + deformation);
    }
    
    // Update materials
    const intensity = Math.max(bassIntensity, midIntensity, highIntensity);
    const hue = 0.6 - (intensity * 0.4); // Shift from blue to red as intensity increases
    const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
    
    cube.material.color.copy(color);
    cube.material.emissive.copy(color).multiplyScalar(intensity * 0.5);
    
    ring.material.color.copy(color);
    ring.material.emissive.copy(color).multiplyScalar(intensity * 0.5);
    
    // Mark geometries for update
    cubePosition.needsUpdate = true;
    ringPosition.needsUpdate = true;
}

// Função para detectar transientes no áudio
function detectTransients(currentBands, previousBands) {
    const transients = new Float32Array(currentBands.length);
    
    for (let i = 0; i < currentBands.length; i++) {
        // Calculate difference from previous frame
        const diff = currentBands[i] - previousBands[i];
        
        // Only consider positive changes (attacks)
        if (diff > 0) {
            // Normalize by the threshold and apply sensitivity
            const normalizedDiff = (diff / transientDetection.threshold) * transientDetection.sensitivity;
            // Apply soft clipping for smoother response
            transients[i] = Math.tanh(normalizedDiff);
        } else {
            // Apply decay to previous peaks
            transients[i] = Math.max(0, (peakHistory[i] || 0) * transientDetection.decayRate);
        }
        
        // Update peak history
        peakHistory[i] = transients[i];
    }
    
    return transients;
}

// =============================
// FASE 3: SISTEMA DE RASTROS
// =============================
let trailSystem = {
    enabled: true,
    length: 20,
    opacity: 0.8,
    decay: 0.95,
    geometries: [],
    materials: [],
    meshes: []
};

function initTrailSystem() {
    // Limpar rastros existentes
    trailSystem.meshes.forEach(mesh => scene.remove(mesh));
    trailSystem.geometries = [];
    trailSystem.materials = [];
    trailSystem.meshes = [];
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(trailSystem.length * 3);
        const colors = new Float32Array(trailSystem.length * 3);
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: trailSystem.opacity,
            blending: THREE.AdditiveBlending
        });
        
        const line = new THREE.Line(geometry, material);
        scene.add(line);
        
        trailSystem.geometries.push(geometry);
        trailSystem.materials.push(material);
        trailSystem.meshes.push(line);
    }
}

function updateTrailSystem() {
    if (!trailSystem.enabled || !particles) return;
    
    const particlePositions = particlesGeometry.attributes.position.array;
    const particleColors = particlesGeometry.attributes.color.array;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const trailGeometry = trailSystem.geometries[i];
        const positions = trailGeometry.attributes.position.array;
        const colors = trailGeometry.attributes.color.array;
        
        // Deslocar posições anteriores
        for (let j = trailSystem.length - 1; j > 0; j--) {
            positions[j * 3] = positions[(j - 1) * 3];
            positions[j * 3 + 1] = positions[(j - 1) * 3 + 1];
            positions[j * 3 + 2] = positions[(j - 1) * 3 + 2];
            
            colors[j * 3] = colors[(j - 1) * 3] * trailSystem.decay;
            colors[j * 3 + 1] = colors[(j - 1) * 3 + 1] * trailSystem.decay;
            colors[j * 3 + 2] = colors[(j - 1) * 3 + 2] * trailSystem.decay;
        }
        
        // Atualizar primeira posição com posição atual da partícula
        positions[0] = particlePositions[i * 3];
        positions[1] = particlePositions[i * 3 + 1];
        positions[2] = particlePositions[i * 3 + 2];
        
        colors[0] = particleColors[i * 3];
        colors[1] = particleColors[i * 3 + 1];
        colors[2] = particleColors[i * 3 + 2];
        
        trailGeometry.attributes.position.needsUpdate = true;
        trailGeometry.attributes.color.needsUpdate = true;
    }
}

// =============================
// FASE 3: OTIMIZAÇÕES DE PERFORMANCE
// =============================

// Sistema de particionamento espacial
const spatialGrid = {
    size: 5,
    cells: {},
    update: function() {
        this.cells = {};
        if (!particlesGeometry || !particlesGeometry.attributes) return;
        
        const positions = particlesGeometry.attributes.position.array;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const x = Math.floor(positions[i * 3] / this.size);
            const y = Math.floor(positions[i * 3 + 1] / this.size);
            const z = Math.floor(positions[i * 3 + 2] / this.size);
            const key = `${x},${y},${z}`;
            
            if (!this.cells[key]) this.cells[key] = [];
            this.cells[key].push(i);
        }
    },
    getParticlesInRange: function(position, range) {
        const minX = Math.floor((position.x - range) / this.size);
        const maxX = Math.floor((position.x + range) / this.size);
        const minY = Math.floor((position.y - range) / this.size);
        const maxY = Math.floor((position.y + range) / this.size);
        const minZ = Math.floor((position.z - range) / this.size);
        const maxZ = Math.floor((position.z + range) / this.size);
        
        const particles = [];
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = `${x},${y},${z}`;
                    if (this.cells[key]) {
                        particles.push(...this.cells[key]);
                    }
                }
            }
        }
        return particles;
    }
};

// Sistema de Frustum Culling
const frustumCulling = {
    frustum: new THREE.Frustum(),
    matrix: new THREE.Matrix4(),
    update: function(camera) {
        this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.matrix);
    },
    isPointVisible: function(point) {
        return this.frustum.containsPoint(point);
    }
};

// Sistema de Object Pooling para Trails
const trailPool = {
    pool: [],
    init: function(size) {
        // Limpar pool existente
        this.pool.forEach(obj => {
            if (obj.mesh) scene.remove(obj.mesh);
        });
        this.pool = [];
        
        // Criar novo pool
        for (let i = 0; i < size; i++) {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(trailSystem.length * 3);
            const colors = new Float32Array(trailSystem.length * 3);
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            const material = new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: trailSystem.opacity,
                blending: THREE.AdditiveBlending
            });
            
            const mesh = new THREE.Line(geometry, material);
            scene.add(mesh);
            
            this.pool.push({
                mesh,
                geometry,
                material,
                inUse: false
            });
        }
    },
    get: function() {
        for (let i = 0; i < this.pool.length; i++) {
            if (!this.pool[i].inUse) {
                this.pool[i].inUse = true;
                return this.pool[i];
            }
        }
        return null;
    },
    release: function(object) {
        const poolObj = this.pool.find(obj => obj.mesh === object);
        if (poolObj) {
            poolObj.inUse = false;
            // Reset geometry
            const positions = poolObj.geometry.attributes.position.array;
            const colors = poolObj.geometry.attributes.color.array;
            positions.fill(0);
            colors.fill(0);
            poolObj.geometry.attributes.position.needsUpdate = true;
            poolObj.geometry.attributes.color.needsUpdate = true;
        }
    }
};

// Sistema de Adaptive Timestep
const adaptivePerformance = {
    lastTime: 0,
    frameCount: 0,
    fps: 60,
    targetFps: 30,
    qualityLevels: {
        high: {
            particleCount: PARTICLE_COUNT,
            trailLength: 20,
            updateFrequency: 1
        },
        medium: {
            particleCount: Math.floor(PARTICLE_COUNT * 0.7),
            trailLength: 10,
            updateFrequency: 2
        },
        low: {
            particleCount: Math.floor(PARTICLE_COUNT * 0.4),
            trailLength: 5,
            updateFrequency: 3
        }
    },
    currentQuality: 'high',
    frameSkip: 0,
    
    update: function() {
        const now = performance.now();
        this.frameCount++;
        
        if (now - this.lastTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastTime = now;
            
            // Ajustar qualidade baseado no FPS
            if (this.fps < this.targetFps * 0.7) {
                this.decreaseQuality();
            } else if (this.fps > this.targetFps * 1.3) {
                this.increaseQuality();
            }
        }
        
        return this.frameSkip === 0;
    },
    
    decreaseQuality: function() {
        if (this.currentQuality === 'high') {
            this.currentQuality = 'medium';
            this.applyQualitySettings('medium');
        } else if (this.currentQuality === 'medium') {
            this.currentQuality = 'low';
            this.applyQualitySettings('low');
        }
    },
    
    increaseQuality: function() {
        if (this.currentQuality === 'low') {
            this.currentQuality = 'medium';
            this.applyQualitySettings('medium');
        } else if (this.currentQuality === 'medium') {
            this.currentQuality = 'high';
            this.applyQualitySettings('high');
        }
    },
    
    applyQualitySettings: function(level) {
        const settings = this.qualityLevels[level];
        this.frameSkip = settings.updateFrequency - 1;
        trailSystem.length = settings.trailLength;
        initTrailSystem();
    }
};


// Event listeners will be initialized in DOMContentLoaded
// Evento de carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the 3D scene and audio system
    init();

    // Basic audio controls
    const audioInput = document.getElementById('audioInput');
    const playButton = document.getElementById('playButton');
    const pauseButton = document.getElementById('pauseButton');
    const volumeSlider = document.getElementById('volumeSlider');
    
    if (audioInput) {
        audioInput.addEventListener('change', event => {
            const file = event.target.files[0];
            if (file && file.type === 'audio/wav') {
                loadAudioFile(file);
            } else {
                console.warn('⚠️ Por favor, selecione um arquivo WAV válido.');
            }
        });
    }

    if (playButton) {
        playButton.addEventListener('click', () => {
            playAudio();
            adsrSystem.trigger();
        });
    }

    if (pauseButton) {
        pauseButton.addEventListener('click', () => {
            pauseAudio();
            adsrSystem.release();
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', event => {
            setVolume(event.target.value);
        });
    }

    // Controls bar toggle
    const controlsBar = document.getElementById('controlsBar');
    const toggleBtn = document.getElementById('toggleControlsBar');
    if (controlsBar && toggleBtn) {
        let minimized = false;
        toggleBtn.addEventListener('click', () => {
            minimized = !minimized;
            controlsBar.classList.toggle('minimized', minimized);
            toggleBtn.innerText = minimized ? '⏶' : '⏷';
        });
    }

    // Advanced analysis controls
    const frequencyMappingSelect = document.getElementById('frequencyMapping');
    const smoothingFactorSlider = document.getElementById('smoothingFactor');
    const transientSensitivitySlider = document.getElementById('transientSensitivity');
    const smoothingValue = document.getElementById('smoothingValue');
    const sensitivityValue = document.getElementById('sensitivityValue');

    if (frequencyMappingSelect) {
        frequencyMappingSelect.addEventListener('change', (event) => {
            CONFIG.frequencyMapping = event.target.value;
        });
    }

    if (smoothingFactorSlider && smoothingValue) {
        smoothingFactorSlider.addEventListener('input', (event) => {
            const value = parseFloat(event.target.value);
            CONFIG.smoothingFactor = value;
            smoothingValue.textContent = value.toFixed(1);
        });
    }

    if (transientSensitivitySlider && sensitivityValue) {
        transientSensitivitySlider.addEventListener('input', (event) => {
            const value = parseFloat(event.target.value);
            transientDetection.sensitivity = value;
            sensitivityValue.textContent = value.toFixed(1);
        });
    }

    // Trail system controls
    const trailLengthSlider = document.getElementById('trailLength');
    const trailOpacitySlider = document.getElementById('trailOpacity');
    const toggleTrailsBtn = document.getElementById('toggleTrails');
    const resetBtn = document.getElementById('resetToDefaults');
    const trailLengthValue = document.getElementById('trailLengthValue');
    const trailOpacityValue = document.getElementById('trailOpacityValue');

    if (trailLengthSlider && trailLengthValue) {
        trailLengthSlider.addEventListener('input', (event) => {
            const value = parseInt(event.target.value);
            trailSystem.length = value;
            trailLengthValue.textContent = value.toString();
            initTrailSystem();
        });
    }

    if (trailOpacitySlider && trailOpacityValue) {
        trailOpacitySlider.addEventListener('input', (event) => {
            const value = parseFloat(event.target.value);
            trailSystem.opacity = value;
            trailOpacityValue.textContent = value.toFixed(1);
            trailSystem.materials.forEach(material => {
                material.opacity = value;
            });
        });
    }

    if (toggleTrailsBtn) {
        toggleTrailsBtn.addEventListener('click', () => {
            trailSystem.enabled = !trailSystem.enabled;
            toggleTrailsBtn.textContent = trailSystem.enabled ? 'Desativar Rastros' : 'Ativar Rastros';
            trailSystem.meshes.forEach(mesh => {
                mesh.visible = trailSystem.enabled;
            });
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // Reset control values
            if (smoothingFactorSlider) smoothingFactorSlider.value = '0.7';
            if (transientSensitivitySlider) transientSensitivitySlider.value = '1.0';
            if (trailLengthSlider) trailLengthSlider.value = '20';
            if (trailOpacitySlider) trailOpacitySlider.value = '0.8';
            if (frequencyMappingSelect) frequencyMappingSelect.value = 'logarithmic';

            // Reset system values
            CONFIG.smoothingFactor = 0.7;
            transientDetection.sensitivity = 1.0;
            trailSystem.length = 20;
            trailSystem.opacity = 0.8;
            CONFIG.frequencyMapping = 'logarithmic';

            // Update displays
            if (smoothingValue) smoothingValue.textContent = '0.7';
            if (sensitivityValue) sensitivityValue.textContent = '1.0';
            if (trailLengthValue) trailLengthValue.textContent = '20';
            if (trailOpacityValue) trailOpacityValue.textContent = '0.8';

            // Reinitialize systems
            initTrailSystem();
        });
    }

    // ADSR controls
    const adsrControls = {
        attack: { slider: 'attackTime', value: 'attackValue' },
        decay: { slider: 'decayTime', value: 'decayValue' },
        sustain: { slider: 'sustainLevel', value: 'sustainValue' },
        release: { slider: 'releaseTime', value: 'releaseValue' }
    };

    Object.entries(adsrControls).forEach(([param, elements]) => {
        const slider = document.getElementById(elements.slider);
        const valueDisplay = document.getElementById(elements.value);
        
        if (slider && valueDisplay) {
            slider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                adsrSystem.settings[param] = value;
                valueDisplay.textContent = value.toFixed(2);
            });
        }
    });

    // Initialize band customization controls
    initBandControls();
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

function initBandControls() {
    const bandControlsContainer = document.getElementById('bandControls');
    if (!bandControlsContainer) return;

    // Clear existing controls
    bandControlsContainer.innerHTML = '';

    // Create controls for each frequency band
    FREQUENCY_BANDS.ranges.forEach((band, index) => {
        const controlDiv = document.createElement('div');
        controlDiv.className = 'control-item';
        controlDiv.style.backgroundColor = band.color + '22'; // Semi-transparent background
        controlDiv.style.padding = '8px';
        controlDiv.style.borderRadius = '4px';

        const label = document.createElement('label');
        label.textContent = `${band.name} (${band.min}-${band.max}Hz):`;
        label.style.color = band.color;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '2';
        slider.step = '0.1';
        slider.value = '1';
        slider.className = 'band-intensity';
        slider.dataset.bandIndex = index;

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'value-display';
        valueDisplay.textContent = '1.0';

        slider.addEventListener('input', (event) => {
            const value = parseFloat(event.target.value);
            band.intensity = value;
            valueDisplay.textContent = value.toFixed(1);
        });

        controlDiv.appendChild(label);
        controlDiv.appendChild(slider);
        controlDiv.appendChild(valueDisplay);
        bandControlsContainer.appendChild(controlDiv);
    });
}

function calculateParticleColor(particle, amplitude, transientValue) {
    // Base color based on frequency (HSL for easier manipulation)
    const hue = particle.frequency * 360;
    const saturation = 50 + amplitude * 50;
    const lightness = 50 + transientValue * 25;
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function drawGlowingParticle(particle) {
    const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.radius * 2
    );
    
    // Inner glow (particle color)
    gradient.addColorStop(0, particle.color);
    // Outer glow (transparent)
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * 2, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw the actual particle on top
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.fill();
}

function drawParticleTrail(particle) {
    if (!particle.trail) return;
    
    ctx.beginPath();
    ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
    
    for (let i = 1; i < particle.trail.length; i++) {
        const point = particle.trail[i];
        ctx.lineTo(point.x, point.y);
    }
    
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = particle.radius * 0.5;
    ctx.lineCap = 'round';
    ctx.stroke();
}