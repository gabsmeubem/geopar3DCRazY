# FASE 3: ANÁLISE AVANÇADA DE FREQUÊNCIA E MAPEAMENTO

## CONTEXTO DO PROJETO
Continuar desenvolvimento do **Simulador de Partículas e Áudio 3D**. As FASES 1 e 2 estão funcionando perfeitamente:
- ✅ **FASE 1**: Estrutura base + carregamento de áudio WAV
- ✅ **FASE 2**: Sistema básico de 400 partículas reagindo ao áudio
- 🎯 **FASE 3**: Implementar análise sofisticada de frequência e mapeamento visual avançado

## OBJETIVO DA FASE 3
Criar sistema de análise de frequência com **16 bandas especializadas** e mapeamento visual sofisticado que diferencia instrumentos musicais, mantendo **30-60fps estável**.

## ANÁLISE DO CÓDIGO ATUAL
O projeto atual já possui:
- Sistema de partículas com 400 partículas em 4 grupos básicos
- Análise FFT básica (1024 samples)
- Deformação do cubo/anel central sincronizada
- Controles de tamanho, brilho e velocidade de vibração
- Performance otimizada para Intel UHD Graphics

## IMPLEMENTAÇÕES NECESSÁRIAS

### 1. ANÁLISE DE FREQUÊNCIA AVANÇADA
**Substituir o sistema atual de 4 bandas por 16 bandas especializadas:**

```javascript
// Adicionar após as constantes globais existentes:
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
```

### 2. SISTEMA DE DETECÇÃO DE PICOS E TRANSIENTES
**Implementar detecção de mudanças bruscas na música:**

```javascript
// Adicionar variáveis para análise temporal
let previousFrequencyData = new Float32Array(16);
let peakHistory = new Array(16).fill(0);
let transientDetection = {
    threshold: 0.3,
    decayRate: 0.95,
    sensitivity: 1.0
};
```

### 3. SMOOTHING TEMPORAL AVANÇADO
**Implementar suavização para evitar tremulação (jittering):**

```javascript
function smoothFrequencyData(currentData, previousData, smoothingFactor = 0.7) {
    const smoothedData = new Float32Array(currentData.length);
    for (let i = 0; i < currentData.length; i++) {
        smoothedData[i] = previousData[i] * smoothingFactor + 
                         currentData[i] * (1 - smoothingFactor);
    }
    return smoothedData;
}
```

### 4. MAPEAMENTO LOGARÍTMICO DE FREQUÊNCIAS
**Converter análise linear para logarítmica (mais natural ao ouvido humano):**

```javascript
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
```

### 5. MAPEAMENTO VISUAL SOFISTICADO
**Reorganizar partículas em 16 grupos especializados:**

```javascript
// Modificar a inicialização das partículas para 16 grupos
const PARTICLES_PER_BAND = Math.floor(PARTICLE_COUNT / 16);

function redistributeParticles() {
    const positions = particlesGeometry.attributes.position.array;
    const colors = particlesGeometry.attributes.color.array;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const bandIndex = Math.floor(i / PARTICLES_PER_BAND);
        const band = FREQUENCY_BANDS.ranges[bandIndex] || FREQUENCY_BANDS.ranges[15];
        
        // Posicionar partículas em camadas concêntricas por frequência
        const layer = bandIndex / 16; // 0 (centro) a 1 (exterior)
        const radius = 2.5 + layer * 3.0; // Graves no centro, agudos na periferia
        
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
        
        // Cor inicial baseada na banda
        const color = new THREE.Color(band.color);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    
    particlesGeometry.attributes.position.needsUpdate = true;
    particlesGeometry.attributes.color.needsUpdate = true;
}
```

### 6. SISTEMA DE RASTROS (TRAILS)
**Implementar rastros visuais para cada partícula:**

```javascript
// Adicionar variáveis para sistema de rastros
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
```

### 7. CONTROLES AVANÇADOS DE INTERFACE
**Adicionar ao HTML, após os controles existentes:**

```html
<div id="advancedControls">
    <h3>Análise de Frequência Avançada</h3>
    
    <label for="frequencyMapping">Tipo de Mapeamento:</label>
    <select id="frequencyMapping">
        <option value="logarithmic">Logarítmico (Natural)</option>
        <option value="linear">Linear</option>
        <option value="mel">Escala Mel</option>
    </select>
    
    <label for="smoothingFactor">Suavização Temporal:</label>
    <input type="range" id="smoothingFactor" min="0.1" max="0.9" step="0.1" value="0.7">
    <span id="smoothingValue">0.7</span>
    
    <label for="transientSensitivity">Sensibilidade a Transientes:</label>
    <input type="range" id="transientSensitivity" min="0.1" max="2.0" step="0.1" value="1.0">
    <span id="transientValue">1.0</span>
    
    <label for="trailLength">Comprimento dos Rastros:</label>
    <input type="range" id="trailLength" min="5" max="50" step="5" value="20">
    <span id="trailLengthValue">20</span>
    
    <label for="trailOpacity">Opacidade dos Rastros:</label>
    <input type="range" id="trailOpacity" min="0.1" max="1.0" step="0.1" value="0.8">
    <span id="trailOpacityValue">0.8</span>
    
    <button id="toggleTrails">Desativar Rastros</button>
    <button id="resetToDefaults">Resetar Configurações</button>
</div>
```

### 8. FUNÇÃO PRINCIPAL DE ANÁLISE AVANÇADA
**Substituir a função `deformCubeWithWaveform()` atual:**

```javascript
function advancedAudioAnalysis() {
    if (!analyser) return;
    
    // Obter dados de frequência
    const bufferLength = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(frequencyData);
    
    // Converter para 16 bandas logarítmicas
    const bands = getLogarithmicFrequencyBands(frequencyData);
    
    // Aplicar suavização temporal
    const smoothedBands = smoothFrequencyData(bands, previousFrequencyData);
    
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
}
```

## OTIMIZAÇÕES CRÍTICAS

### Performance
- **Spatial partitioning**: Dividir partículas em setores para cálculos eficientes
- **Adaptive timestep**: Reduzir qualidade em baixo FPS
- **Frustum culling**: Não processar partículas fora da tela
- **Object pooling**: Reutilizar objetos de rastro

### Memória
- **Buffer reutilização**: Não criar novos arrays a cada frame
- **Cleanup automático**: Remover rastros antigos
- **Throttling**: Limitar análise a 30fps para economia de CPU

## CONTROLES ESSENCIAIS

### Personalização por Banda
```html
<div id="bandCustomization">
    <h4>Personalização por Banda de Frequência</h4>
    <!-- Sliders individuais para cada uma das 16 bandas -->
    <div class="band-controls" data-band="0">
        <label>SubBass (20-60Hz):</label>
        <input type="range" class="band-intensity" min="0" max="2" step="0.1" value="1">
    </div>
    <!-- Repetir para todas as 16 bandas -->
</div>
```

### Curva de Intensidade (ADSR)
```html
<div id="intensityCurve">
    <h4>Curva de Intensidade (ADSR)</h4>
    <label>Attack:</label>
    <input type="range" id="attackTime" min="0.01" max="1" step="0.01" value="0.1">
    
    <label>Decay:</label>
    <input type="range" id="decayTime" min="0.1" max="2" step="0.1" value="0.5">
    
    <label>Sustain:</label>
    <input type="range" id="sustainLevel" min="0" max="1" step="0.1" value="0.7">
    
    <label>Release:</label>
    <input type="range" id="releaseTime" min="0.1" max="3" step="0.1" value="1.0">
</div>
```

## TESTE DA FASE 3

### Critérios de Sucesso
1. **Diferenciação de Instrumentos**: Bateria deve criar padrões diferentes de violão
2. **Resposta Suave**: Sem tremulação (jittering) visual
3. **Detecção de Transientes**: Explosões visuais em mudanças bruscas
4. **Performance Estável**: Manter 30fps mínimo com 400 partículas
5. **Controles Funcionais**: Todos os sliders e botões responsivos

### Música de Teste Recomendada
- **Teste 1**: Música eletrônica (graves marcados)
- **Teste 2**: Música clássica (ampla gama de frequências)
- **Teste 3**: Rock/Metal (transientes de bateria)
- **Teste 4**: Jazz (instrumentos médios complexos)

## DEBUGGING E MONITORAMENTO

```javascript
// Adicionar ao console.log
const DEBUG_MODE = true;

function logFrequencyAnalysis(bands, transients) {
    if (!DEBUG_MODE) return;
    
    console.log('🎵 Análise de Frequência:');
    console.log('Graves dominantes:', bands.slice(0, 4).reduce((a, b) => a + b) / 4);
    console.log('Médios dominantes:', bands.slice(4, 8).reduce((a, b) => a + b) / 4);
    console.log('Agudos dominantes:', bands.slice(8, 12).reduce((a, b) => a + b) / 4);
    console.log('Ultra-agudos:', bands.slice(12, 16).reduce((a, b) => a + b) / 4);
    console.log('Transientes detectados:', transients.filter(t => t > 0.5).length);
}
```

## INSTRUÇÕES ESPECÍFICAS

### ⚠️ IMPORTANTE
1. **NÃO QUEBRAR** a funcionalidade existente da FASE 2
2. **MANTER** os controles atuais funcionando
3. **ADICIONAR** gradualmente os novos recursos
4. **TESTAR** performance a cada implementação
5. **COMENTAR** cada função crítica em português

### Ordem de Implementação
1. Implementar sistema de 16 bandas
2. Adicionar suavização temporal
3. Implementar detecção de transientes
4. Criar sistema de rastros básico
5. Adicionar controles de interface
6. Otimizar performance final

## COMPATIBILIDADE
- Manter suporte a Chrome/Firefox/Safari/Edge
- Responsividade mobile (controles touch)
- Fallback para hardware limitado
- Graceful degradation

---

**🎯 FOCO DA FASE 3**: Transformar visualização básica em análise sofisticada que revela a "personalidade" de cada música, diferenciando instrumentos e criando padrões únicos para cada tipo de áudio.

**📊 META DE PERFORMANCE**: 30fps estável com 400 partículas + 16 bandas + sistema de rastros completo.